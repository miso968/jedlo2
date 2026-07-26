// All recipe-related API routes.
// Every query below uses parameter binding ( ? placeholders ) — never string
// concatenation — so user input can never alter the SQL structure (no SQL injection).

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/init');

const router = express.Router();

// ---------- image upload setup ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `img_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
        }
        cb(null, true);
    },
});

// ---------- helpers ----------
function slugify(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'recipe';
}

function uniqueSlug(baseTitle) {
    const base = slugify(baseTitle);
    let slug = base;
    let n = 1;
    const exists = db.prepare('SELECT 1 FROM recipes WHERE slug = ?');
    while (exists.get(slug)) {
        n += 1;
        slug = `${base}-${n}`;
    }
    return slug;
}

function findOrCreateIngredientId(rawName) {
    const name = String(rawName || '').trim().toLowerCase();
    if (!name) return null;
    const existing = db.prepare('SELECT id FROM ingredients WHERE name = ?').get(name);
    if (existing) return existing.id;
    const info = db.prepare('INSERT INTO ingredients (name) VALUES (?)').run(name);
    return info.lastInsertRowid;
}

function attachIngredients(recipeId, ingredients) {
    const link = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit)
        VALUES (?, ?, ?, ?)
    `);
    for (const ing of ingredients) {
        const ingredientId = findOrCreateIngredientId(ing.name);
        if (!ingredientId) continue; // skip blank rows silently
        link.run(recipeId, ingredientId, ing.amount || null, ing.unit || null);
    }
}

function getIngredientsForRecipe(recipeId) {
    return db.prepare(`
        SELECT i.name, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
        ORDER BY i.name
    `).all(recipeId);
}

// ---------- GET /api/ingredients/suggest?q=... ----------
// Powers the autocomplete box on the search page.
router.get('/ingredients/suggest', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    const rows = db.prepare(`
        SELECT name FROM ingredients
        WHERE name LIKE ?
        ORDER BY name
        LIMIT 10
    `).all(`%${q}%`);
    res.json(rows.map(r => r.name));
});

// ---------- GET /api/recipes ----------
// Optional ?ingredients=tomato,basil,garlic  -> ranked ingredient-based search
// With no query param, returns all approved recipes (newest first).
router.get('/recipes', (req, res) => {
    const raw = String(req.query.ingredients || '').trim();

    if (!raw) {
        const rows = db.prepare(`
            SELECT id, title, slug, image, prep_time, created_at
            FROM recipes
            WHERE approved = 1
            ORDER BY created_at DESC
        `).all();
        return res.json(rows);
    }

    const wanted = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (wanted.length === 0) return res.json([]);

    // Build one LIKE clause per searched ingredient so "chicken breast" also
    // matches an ingredient row literally named "chicken breast", while still
    // allowing partial word matches like "chick" -> "chicken".
    const likeClauses = wanted.map(() => 'i.name LIKE ?').join(' OR ');
    const likeParams = wanted.map(w => `%${w}%`);

    const rows = db.prepare(`
        SELECT
            r.id, r.title, r.slug, r.image, r.prep_time, r.created_at,
            COUNT(DISTINCT ri.ingredient_id) AS matched_count,
            (SELECT COUNT(*) FROM recipe_ingredients ri2 WHERE ri2.recipe_id = r.id) AS total_count
        FROM recipes r
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE r.approved = 1 AND (${likeClauses})
        GROUP BY r.id
        ORDER BY matched_count DESC, total_count ASC, r.created_at DESC
    `).all(...likeParams);

    const results = rows.map(r => ({
        ...r,
        is_full_match: r.matched_count >= r.total_count,
    }));

    res.json(results);
});

// ---------- GET /api/recipes/:id ----------
router.get('/recipes/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid recipe id.' });

    const recipe = db.prepare(`
        SELECT id, title, slug, instructions, prep_time, image, created_at
        FROM recipes WHERE id = ? AND approved = 1
    `).get(id);

    if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });

    recipe.ingredients = getIngredientsForRecipe(id);
    res.json(recipe);
});

// ---------- POST /api/recipes ----------
// multipart/form-data: title, instructions, prep_time, ingredients (JSON string), image (file, optional)
router.post('/recipes', upload.single('image'), (req, res) => {
    try {
        const { title, instructions, prep_time } = req.body;

        if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
        if (!instructions || !instructions.trim()) return res.status(400).json({ error: 'Instructions are required.' });

        let ingredients = [];
        if (req.body.ingredients) {
            try {
                ingredients = JSON.parse(req.body.ingredients);
            } catch {
                return res.status(400).json({ error: 'Ingredients must be valid JSON.' });
            }
        }
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ error: 'At least one ingredient is required.' });
        }
        const validIngredients = ingredients.filter(i => i && String(i.name || '').trim());
        if (validIngredients.length === 0) {
            return res.status(400).json({ error: 'At least one ingredient with a name is required.' });
        }

        const prepTimeNum = prep_time ? parseInt(prep_time, 10) : null;
        const image = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.png';
        const slug = uniqueSlug(title);

        const insertRecipe = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO recipes (title, slug, instructions, prep_time, image, approved)
                VALUES (?, ?, ?, ?, ?, 0)
            `).run(title.trim(), slug, instructions.trim(), prepTimeNum, image);

            attachIngredients(info.lastInsertRowid, validIngredients);
            return info.lastInsertRowid;
        });

        const recipeId = insertRecipe();

        res.status(201).json({
            message: 'Recipe submitted! It will appear once an admin approves it.',
            id: recipeId,
            slug,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong while saving the recipe.' });
    }
});

// ---------- Admin moderation ----------

// GET /api/admin/pending
router.get('/admin/pending', (req, res) => {
    const rows = db.prepare(`
        SELECT id, title, prep_time, created_at FROM recipes
        WHERE approved = 0 ORDER BY created_at ASC
    `).all();
    res.json(rows);
});

// POST /api/admin/approve/:id
router.post('/admin/approve/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid recipe id.' });
    const info = db.prepare('UPDATE recipes SET approved = 1 WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Recipe not found.' });
    res.json({ message: 'Recipe approved.' });
});

// ---------- POST /api/help ----------
// Simple contact form (name, email, problem description).
router.post('/help', (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const problem = String(req.body.problem || '').trim();

    if (!name || !email || !problem) {
        return res.status(400).json({ error: 'Name, email and problem description are all required.' });
    }
    // Very small sanity check — not a full RFC 5322 validator, just catches obvious typos.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    db.prepare('INSERT INTO help_requests (name, email, problem) VALUES (?, ?, ?)').run(name, email, problem);
    res.status(201).json({ message: 'Thanks — we received your message and will get back to you soon.' });
});

module.exports = router;
