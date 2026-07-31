// Optional: run with `npm run seed` to populate the database with a few
// sample, already-approved recipes so the search page isn't empty on first run.

const ensureSchema = require('./init');
const pool = require('./pool');

function slugify(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function findOrCreateIngredient(name) {
    const clean = name.trim().toLowerCase();
    const [existing] = await pool.execute('SELECT id FROM ingredients WHERE name = ?', [clean]);
    if (existing.length > 0) return existing[0].id;
    const [result] = await pool.execute('INSERT INTO ingredients (name) VALUES (?)', [clean]);
    return result.insertId;
}

async function insertRecipe({ title, instructions, prep_time, ingredients }) {
    const slug = slugify(title);
    const [result] = await pool.execute(`
        INSERT INTO recipes (title, slug, instructions, prep_time, approved)
        VALUES (?, ?, ?, ?, 1)
    `, [title, slug, instructions, prep_time]);

    const recipeId = result.insertId;
    for (const ing of ingredients) {
        const ingredientId = await findOrCreateIngredient(ing.name);
        await pool.execute(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount, unit) VALUES (?, ?, ?, ?)',
            [recipeId, ingredientId, ing.amount || null, ing.unit || null]
        );
    }
}

const sample = [
    {
        title: 'Tomato Basil Pasta',
        instructions: '1. Cook pasta until al dente.\n2. Saute garlic in olive oil, add chopped tomatoes, simmer 10 minutes.\n3. Stir in fresh basil and toss with pasta. Season with salt and pepper.',
        prep_time: 25,
        ingredients: [
            { name: 'pasta', amount: '200', unit: 'g' },
            { name: 'tomato', amount: '4', unit: '' },
            { name: 'garlic', amount: '2', unit: 'cloves' },
            { name: 'basil', amount: '1', unit: 'handful' },
            { name: 'olive oil', amount: '2', unit: 'tbsp' },
        ],
    },
    {
        title: 'Simple Veggie Omelette',
        instructions: '1. Whisk eggs with a pinch of salt.\n2. Saute chopped onion and pepper until soft.\n3. Pour eggs over vegetables, cook until set, fold and serve.',
        prep_time: 15,
        ingredients: [
            { name: 'egg', amount: '3', unit: '' },
            { name: 'onion', amount: '1', unit: '' },
            { name: 'bell pepper', amount: '1', unit: '' },
            { name: 'salt', amount: '1', unit: 'pinch' },
        ],
    },
    {
        title: 'Garlic Butter Rice',
        instructions: '1. Melt butter, saute minced garlic until fragrant.\n2. Add rice and stock, bring to a boil.\n3. Cover and simmer 18 minutes until liquid is absorbed.',
        prep_time: 30,
        ingredients: [
            { name: 'rice', amount: '1', unit: 'cup' },
            { name: 'garlic', amount: '3', unit: 'cloves' },
            { name: 'butter', amount: '2', unit: 'tbsp' },
            { name: 'vegetable stock', amount: '2', unit: 'cups' },
        ],
    },
];

async function main() {
    await ensureSchema();

    const [existing] = await pool.execute('SELECT COUNT(*) AS c FROM recipes');
    if (existing[0].c > 0) {
        console.log(`Database already has ${existing[0].c} recipe(s) — skipping seed.`);
        process.exit(0);
    }

    for (const recipe of sample) {
        await insertRecipe(recipe);
    }

    console.log(`Seeded ${sample.length} sample recipes.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Seeding failed:', err.message);
    process.exit(1);
});
