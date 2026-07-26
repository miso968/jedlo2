-- Recipe Finder database schema (SQLite)
-- Run automatically by db/init.js on first start.

PRAGMA foreign_keys = ON;

-- One row per recipe
CREATE TABLE IF NOT EXISTS recipes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    instructions  TEXT NOT NULL,
    prep_time     INTEGER,              -- minutes
    image         TEXT DEFAULT '/uploads/default.png',
    approved      INTEGER NOT NULL DEFAULT 0, -- 0 = pending moderation, 1 = live
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per unique ingredient name (deduplicated, case-insensitive)
CREATE TABLE IF NOT EXISTS ingredients (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
);

-- M:N join table between recipes and ingredients, with quantity/unit metadata
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id)     ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    amount        TEXT,   -- free-text quantity, e.g. "200", "2"
    unit          TEXT,   -- free-text unit, e.g. "g", "cups", "cloves"
    PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_approved ON recipes(approved);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

-- Simple contact/help form submissions
CREATE TABLE IF NOT EXISTS help_requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    problem    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
