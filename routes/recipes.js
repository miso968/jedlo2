// All recipe-related API routes.
// Every query below uses parameter binding ( ? placeholders ) — never string
// concatenation — so user input can never alter the SQL structure (no SQL injection).

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');

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

async function uniqueSlug(baseTitle) {
    const base = slugify(baseTitle);
    let slug = base;
    let n = 1;
    while (true) {
        const [rows] = await pool.execute('SELECT 1 FROM recipes WHERE slug = ? LIMIT 1', [slug]);
        if (rows.length === 0) return slug;
        n += 1;
        slug = `${base}-${n}`;
    }
}

async function findOrCreateIngredientId(rawName, connection = pool) {
    const name = String(rawName || '').trim().toLowerCase();
    if (!name) return null;
    const [existingRows] = await connection.execute('SELECT id FROM ingredients WHERE name = ?', [name]);
    if (existingRows.length > 0) return existingRows[0].id;
    const [result] = await connection.execute('INSERT INTO ingredients (name) VALUES (?)', [name]);
    return result.insertId;
}

async function attachIngredients(recipeId, ingredients, connection) {
    for (const ing of ingredients) {
        const ingredientId = await findOrCreateIngredientId(ing.name, connection);
        if (!ingredientId) continue; // skip blank rows silently
        await connection.execute(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit) VALUES (?, ?, ?, ?)',
            [recipeId, ingredientId, ing.amount || null, ing.unit || null]
        );
    }
}

async function getIngredientsForRecipe(recipeId) {
    const [rows] = await pool.execute(`
        SELECT i.name, ri.amount, ri.unit
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
        ORDER BY i.name
    `, [recipeId]);
    return rows;
}

// ---------- GET /api/ingredients/suggest?q=... ----------
// Powers the autocomplete box on the search page.
router.get('/ingredients/suggest', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q) return res.json([]);
        const [rows] = await pool.execute(
            'SELECT name FROM ingredients WHERE name LIKE ? ORDER BY name LIMIT 10',
            [`%${q}%`]
        );
        res.json(rows.map(r => r.name));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not fetch ingredient suggestions.' });
    }
});

// ---------- GET /api/recipes ----------
// Optional ?ingredients=tomato,basil,garlic  -> ranked ingredient-based search
// With no query param, returns all approved recipes (newest first).
router.get('/recipes', async (req, res) => {
    try {
        const raw = String(req.query.ingredients || '').trim();

        if (!raw) {
            const [rows] = await pool.execute(`
                SELECT id, title, slug, image, prep_time, created_at
                FROM recipes
                WHERE approved = 1
                ORDER BY created_at DESC
            `);
            return res.json(rows);
        }

        const wanted = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (wanted.length === 0) return res.json([]);

        const likeClauses = wanted.map(() => 'i.name LIKE ?').join(' OR ');
        const likeParams = wanted.map(w => `%${w}%`);

        const [rows] = await pool.query(`
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
        `, likeParams);

        const results = rows.map(r => ({
            ...r,
            is_full_match: r.matched_count >= r.total_count,
        }));

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed.' });
    }
});

// ---------- GET /api/recipes/:id ----------
router.get('/recipes/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid recipe id.' });

        const [rows] = await pool.execute(`
            SELECT id, title, slug, instructions, prep_time, image, created_at
            FROM recipes WHERE id = ? AND approved = 1
        `, [id]);

        if (rows.length === 0) return res.status(404).json({ error: 'Recipe not found.' });

        const recipe = rows[0];
        recipe.ingredients = await getIngredientsForRecipe(id);
        res.json(recipe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load recipe.' });
    }
});

// ---------- POST /api/recipes ----------
// multipart/form-data: title, instructions, prep_time, ingredients (JSON string), image (file, optional)
router.post('/recipes', upload.single('image'), async (req, res) => {
    let connection;
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
        const slug = await uniqueSlug(title);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(`
            INSERT INTO recipes (title, slug, instructions, prep_time, image, approved)
            VALUES (?, ?, ?, ?, ?, 0)
        `, [title.trim(), slug, instructions.trim(), prepTimeNum, image]);

        const recipeId = result.insertId;
        await attachIngredients(recipeId, validIngredients, connection);

        await connection.commit();

        res.status(201).json({
            message: 'Recipe submitted! It will appear once an admin approves it.',
            id: recipeId,
            slug,
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Something went wrong while saving the recipe.' });
    } finally {
        if (connection) connection.release();
    }
});

// ---------- Admin moderation ----------

// GET /api/admin/pending
router.get('/admin/pending', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT id, title, prep_time, created_at FROM recipes
            WHERE approved = 0 ORDER BY created_at ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not load pending recipes.' });
    }
});

// POST /api/admin/approve/:id
router.post('/admin/approve/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid recipe id.' });
        const [result] = await pool.execute('UPDATE recipes SET approved = 1 WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Recipe not found.' });
        res.json({ message: 'Recipe approved.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not approve recipe.' });
    }
});

// ---------- POST /api/help ----------
// Simple contact form (name, email, problem description).
router.post('/help', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const problem = String(req.body.problem || '').trim();

        if (!name || !email || !problem) {
            return res.status(400).json({ error: 'Name, email and problem description are all required.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        await pool.execute('INSERT INTO help_requests (name, email, problem) VALUES (?, ?, ?)', [name, email, problem]);
        res.status(201).json({ message: 'Thanks — we received your message and will get back to you soon.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not submit your message.' });
    }
});

module.exports = router;
