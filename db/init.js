// Runs schema.sql against the configured MySQL database. Safe to run every
// startup — every statement uses CREATE TABLE IF NOT EXISTS, so it's a no-op
// once the tables already exist.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function ensureSchema() {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // mysql2's execute() doesn't support multiple statements per call, so run
    // each CREATE TABLE statement in schema.sql one at a time.
    const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);

    for (const statement of statements) {
        await pool.query(statement);
    }
}

module.exports = ensureSchema;
