# Pantry.Finder — Recipe Finder by Ingredient

Search, add, and manage recipes based on ingredients you already have.
Rebuilt from an older PHP/MySQL prototype as a self-contained Node.js app
with a local SQLite database — no external DB server or credentials needed.

## Stack

- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3` (synchronous, file-based — one `.db` file, zero setup)
- **Frontend:** Static HTML + vanilla JS + hand-written CSS (no build step)

SQLite was chosen over PostgreSQL for this project because it needs no server
process, no connection string, and no credentials to manage or leak — you get
one `db/recipes.db` file you can back up by copying it. If you later need
multiple servers writing at once, the schema in `db/schema.sql` is close
enough to standard SQL that moving to PostgreSQL mainly means swapping
`better-sqlite3` for a `pg` client.

## Getting started

```bash
npm install
cp .env.example .env      # adjust PORT etc. if you want
npm run seed               # optional: adds 3 sample approved recipes
npm start
```

Then open **http://localhost:3000**.

## Project structure

```
recipe-app/
├── server.js              # Express app entry point
├── db/
│   ├── schema.sql         # table definitions
│   ├── init.js            # opens/creates the SQLite file, applies schema
│   └── seed.js            # optional sample data (npm run seed)
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
- `ingredients` — id, name (unique, case-insensitive by convention — always lowercased before insert)
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

## Security notes (important before deploying)

1. **No authentication on `/admin.html` or the admin API routes yet.**
   Anyone who finds that URL can approve recipes. Before putting this online,
   add at minimum a login check (e.g. `express-session` + a hardcoded admin
   password from an environment variable, or a proper auth library) in front
   of the `/api/admin/*` routes.
2. All SQL queries use parameter binding (`?` placeholders), so user input
   can never be interpreted as SQL — this fixes the SQL-injection issues
   present in the original PHP version's `approve_recipees.php` and others.
3. Credentials now live in `.env` (git-ignored), not hardcoded in source —
   this fixes the exposed database password in the original PHP files.
   **If those old files were ever committed or shared, rotate that
   database password.**
4. Uploaded images are restricted by MIME type and size (5 MB) and renamed
   on disk, so a user can't overwrite existing files or upload disguised
   executable content under an image name.

## Notes on the sandbox this was built in

This was written and syntax-checked in an offline sandbox without network
access, so `npm install` could not be run here to fully execute/test the
server end-to-end. The code follows the documented APIs for Express,
better-sqlite3, and multer, but please run `npm install && npm start`
locally and let me know if anything needs adjusting.

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
