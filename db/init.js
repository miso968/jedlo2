// Opens (or creates) the SQLite database file and makes sure the schema exists.
// better-sqlite3 is synchronous, which keeps route handlers simple and avoids
// a whole class of race-condition bugs you'd otherwise need callbacks/promises for.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'recipes.db');

// Make sure the folder for the DB file exists (matters if DB_FILE is a nested path).
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL'); // better concurrent read/write behaviour

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
