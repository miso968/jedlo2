# Pantry.Finder — Recipe Finder by Ingredient

Search, add, and manage recipes based on ingredients you already have.
Rebuilt from an older PHP/MySQL prototype as a Node.js app that connects to
your existing MySQL database — properly this time, with credentials in
environment variables and parameterized queries instead of hardcoded
passwords and string-concatenated SQL.

## Stack

- **Backend:** Node.js + Express
- **Database:** MySQL (via `mysql2`), connecting to your existing hosted
  database — no new database service needed
- **Frontend:** Static HTML + vanilla JS + hand-written CSS (no build step)

## Getting started

```bash
npm install
cp .env.example .env      # fill in your real DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
npm run seed               # optional: adds 3 sample approved recipes
npm start
```

Then open **http://localhost:3000**. On first start, `server.js` runs
`db/init.js`, which creates the `recipes`, `ingredients`,
`recipe_ingredients`, and `help_requests` tables in your database
automatically (`CREATE TABLE IF NOT EXISTS`, so it's safe to run every time).

## Project structure

```
recipe-app/
├── server.js              # Express app entry point
├── db/
│   ├── schema.sql          # table definitions (MySQL)
│   ├── pool.js             # mysql2 connection pool (reads .env)
│   ├── init.js             # applies schema.sql at startup
│   └── seed.js             # optional sample data (npm run seed)
├── routes/
│   └── recipes.js         # all /api/* endpoints
└── public/                # static frontend, served as-is
    ├── index.html          # ingredient search
    ├── add-recipe.html     # submit a new recipe
    ├── recipe.html         # single recipe detail (?id=)
    ├── help.html           # contact form
    ├── admin.html          # approve pending recipes (see warning below)
    ├── css/style.css
    ├── js/*.js
    └── uploads/            # uploaded recipe photos land here
```

## Database schema

- `recipes` — id, title, slug, instructions, prep_time, image, approved, created_at
- `ingredients` — id, name (unique; always lowercased before insert so it stays case-insensitive)
- `recipe_ingredients` — join table (recipe_id, ingredient_id, amount, unit)
- `help_requests` — contact form submissions

New ingredient names are looked up (case-insensitive) and reused if they
already exist, or created automatically — this is handled in
`findOrCreateIngredientId()` in `routes/recipes.js`.

## API endpoints

| Method | Path                        | Description                                   |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/api/recipes`              | List approved recipes, or rank by `?ingredients=a,b,c` |
| GET    | `/api/recipes/:id`          | Full detail for one approved recipe            |
| POST   | `/api/recipes`              | Submit a new recipe (multipart form, `approved=0` by default) |
| GET    | `/api/ingredients/suggest`  | Autocomplete suggestions (`?q=`)               |
| GET    | `/api/admin/pending`        | List unapproved recipes                        |
| POST   | `/api/admin/approve/:id`    | Approve a recipe                               |
| POST   | `/api/help`                 | Submit a help/contact request                  |

## Security notes

1. **Admin login is now required** for `/admin.html` and every `/api/admin/*`
   route. Set `ADMIN_PASSWORD` and `SESSION_SECRET` in your environment
   (locally in `.env`, on Render under Environment Variables). Generate a
   good session secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Without `SESSION_SECRET` set, the server refuses to start (safer than
   silently running with a weak default).
2. **Rate limiting** is applied to recipe submissions, help-form submissions,
   and admin login attempts (`express-rate-limit`) — this blocks scripted
   spam and brute-force password guessing.
3. **Honeypot fields** — the "add recipe" and "help" forms include a hidden
   field real users never see or fill in. If it arrives filled in, the
   server pretends success but doesn't save anything, which quietly filters
   out simple bots without tipping them off.
4. All SQL queries use parameter binding (`?` placeholders), so user input
   can never be interpreted as SQL — this fixes the SQL-injection issues
   present in the original PHP version's `approve_recipees.php` and others.
5. Credentials live in `.env` (git-ignored) and, when hosted, in your
   platform's environment-variable settings — never hardcoded in source.
   **The original PHP files had this exact database's password hardcoded
   in plain text and were shared outside your server. Rotate that password
   if you haven't already, then update `DB_PASSWORD` everywhere it's used.**
6. Uploaded images are restricted by MIME type and size (5 MB) and renamed
   on disk, so a user can't overwrite existing files or upload disguised
   executable content under an image name.

### Required environment variables (full list)

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `ADMIN_PASSWORD` | Password for `/admin.html` |
| `SESSION_SECRET` | Signs admin session cookies — long random string |
| `PORT` | Set automatically by Render; only needed locally |
| `UPLOAD_DIR` | Optional; defaults to `public/uploads` |

Add `ADMIN_PASSWORD` and `SESSION_SECRET` to Render's Environment Variables
the same way you added the `DB_*` ones, then redeploy.

## Deploying the backend for free on Render

Render's free web-service tier works for this app, with one important
caveat: **Render's free tier has an ephemeral filesystem** — any files
written locally (like uploaded recipe photos in `public/uploads/`) are
wiped every time the service restarts or spins down after 15 minutes of
inactivity. Since this app's actual data (recipes, ingredients) now lives in
your external MySQL database, not on Render's disk, **your recipe data is
safe** — only newly uploaded *photos* would be lost on restart, since those
are still saved to the local disk. If that matters to you, the fix is to
store uploaded images in your MySQL database as well, or in an external
object store (S3, Cloudinary, etc.) instead of the local filesystem — happy
to make that change if you want it.

### Steps in the Render dashboard

1. Push this project to a GitHub (or GitLab) repository — Render deploys
   from a Git repo, not a zip upload.
2. In Render: **New +** → **Web Service** → connect that repository.
3. **Language/Environment:** Node
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Instance Type:** Free
7. Under **Environment Variables**, add:
   - `DB_HOST` = `db001.nameserver.sk`
   - `DB_PORT` = `3306` (or your hosting's port, if different)
   - `DB_USER` = your DB username
   - `DB_PASSWORD` = your DB password (the new, rotated one)
   - `DB_NAME` = `webtestsql`
   - Do **not** set `PORT` — Render sets that automatically and `server.js`
     already reads `process.env.PORT`.
8. Click **Deploy**. Render gives you a URL like
   `https://your-app.onrender.com` once it's live.
9. Put that URL into `public/js/config.js` as `API_BASE_URL` (see the
   mobile app section below) if you're building the phone app.

### One more thing to check on your hosting side

Shared hosting providers often block remote MySQL connections by default —
only allowing connections from the same server (e.g. from PHP scripts on
that same host). Render's servers connect from outside, over the public
internet, so **check your hosting control panel for a "Remote MySQL access"
or "Remote database access" setting** and make sure external connections are
allowed (some panels want you to whitelist an IP; if Render's IPs aren't
fixed/whitelistable in your panel, look for an "allow all hosts" or `%`
wildcard option, and rely on the password + your firewall/host protections
instead).

## Notes on the sandbox this was built in

This was written and syntax-checked in an offline sandbox without network
access, so `npm install` could not be run here to fully execute/test the
server end-to-end (and no live MySQL connection was available to test
against). The code follows the documented APIs for Express, mysql2, and
multer, but please run `npm install && npm start` locally with your real
database credentials and let me know if anything needs adjusting.

## Building the Android/iOS app (Capacitor)

The web frontend in `public/` is wrapped as a native app using
[Capacitor](https://capacitorjs.com) — it reuses the exact same HTML/CSS/JS,
no rewrite needed. The app talks to your Node backend over the network,
so **the backend must be hosted somewhere reachable from the phone**
(a small VPS, Render, Railway, Fly.io, etc. — not your laptop's `localhost`,
unless the phone is on the same Wi-Fi and you use your computer's LAN IP for
testing).

### One-time setup (run locally — needs internet + Android Studio and/or Xcode)

```bash
npm install                    # installs Capacitor CLI + core (already in package.json)
npm run mobile:add-android     # creates the android/ native project (run once)
npm run mobile:add-ios         # creates the ios/ native project (Mac + Xcode only, run once)
```

### Point the app at your hosted backend

Edit `public/js/config.js`:

```js
window.APP_CONFIG = {
  API_BASE_URL: 'https://your-api.example.com',   // your deployed backend's URL
};
```

Leave it as `''` only for local web use — the packaged app has no "same
server" to call relative paths against, so this must be a full URL once
you deploy the backend.

### Build and open in Android Studio / Xcode

```bash
npm run mobile:sync            # copies public/ into the native project + config
npm run mobile:open-android    # opens Android Studio -> Run to install on a device/emulator
npm run mobile:open-ios        # opens Xcode (Mac only) -> Run
```

From Android Studio or Xcode you build/sign the APK or IPA and install it on
a real device the normal way (USB debugging for Android, or a Mac + Apple
Developer account for iOS/TestFlight).

Re-run `npm run mobile:sync` any time you change files in `public/` so the
native project picks up the update.

### Why not a full native rewrite (React Native / Flutter)?

That path gives a more "native" feel and better performance for complex
apps, but means rebuilding every screen with different UI code — none of
the HTML/CSS here would carry over. Capacitor was the pragmatic choice
since it reuses everything already built. If down the line you want a
from-scratch native app, the `/api/*` endpoints here would still be the
backend to build against.
