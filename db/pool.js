// MySQL connection pool. Never hardcode credentials here — they come from
// environment variables (.env locally, or the hosting platform's
// environment-variable settings when deployed, e.g. Render).
require('dotenv').config();
const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
    console.error(`Missing required database environment variable(s): ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill these in (see README.md).');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
});

module.exports = pool;
