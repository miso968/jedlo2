require('dotenv').config();

const express = require('express');
const path = require('path');
const ensureSchema = require('./db/init');
const recipesRouter = require('./routes/recipes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// The web pages are served from this same origin, so CORS isn't needed for
// them. The packaged mobile app (Capacitor) runs from a different origin
// (capacitor://localhost or similar) and calls this server over the network,
// so it needs these headers to be allowed to read the response.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Static frontend (HTML/CSS/JS) and uploaded images
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api', recipesRouter);

// Multer / general error handler (keeps error responses in JSON, not stack traces)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(400).json({ error: err.message || 'Unexpected error.' });
});

async function start() {
    try {
        await ensureSchema(); // creates tables in the MySQL database if they don't exist yet
        app.listen(PORT, () => {
            console.log(`Recipe Finder running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to the database / apply schema:', err.message);
        console.error('Check your DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in .env.');
        process.exit(1);
    }
}

start();
