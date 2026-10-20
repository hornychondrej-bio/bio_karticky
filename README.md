# Bio kartičky (bio_karticky)

A static, dependency-free flashcard web app with FSRS spaced repetition. The UI is in Czech, the code and comments are in English.
Cards live in CSV files served next to the app (e.g. GitHub Pages). Student progress lives in the browser's `localStorage` and can be exported/imported as JSON.

## Run locally

```sh
npm start        # = npx serve .  → open the printed URL (ES modules and fetch need http, not file://)
```

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder to `main`.
2. In *Settings → Pages* set the source to **GitHub Actions**. `.github/workflows/pages.yml` deploys on every push.
3. Edit a CSV, push, and students get the new cards on their next visit (the service worker is network-first).

## Adding card packages

1. Put a CSV into `data/`.
2. Register it in `data/packages.json`:

```json
{
  "packages": [
    {
      "id": "bakterie",
      "title": "Bakterie",
      "description": "Short description",
      "file": "bakterie.csv",
      "parts": [{ "n": 1, "title": "Stavba bakteriální buňky" }]
    }
  ]
}
```

`id` must be unique and stable (it is part of the progress key). `parts` titles are optional; without them the app shows "Část N".

### CSV format

UTF-8, header row required, delimiter (`,` `;` or tab) auto-detected, quoted fields may contain newlines. Anki-style `#` lines at the top are ignored.

| column  | required | meaning |
|---------|----------|---------|
| `id`    | yes | Unique within the package, **never change it** – progress is keyed by it. Fixing typos in `front`/`back` keeps progress. |
| `front` | yes | Question (plain text) |
| `back`  | yes | Answer (plain text) |
| `part`  | no  | Integer, default 1. The part of the package the student unlocks manually. |
| `type`  | no  | `standard` (default), `permanent` or `extra` |
| `tags`  | no  | Space-separated; only used in the Anki export |

## How studying works

- Package → **parts** (switched on manually, no gates) → cards of three types.
- **standard**: studied while its part is active.
- **extra**: like standard, but only if *Extra karty* is on (the optional harder subset).
- **permanent**: studied if *Trvalé karty* is on and its part was activated at least once – they stay even after the part is switched off.
- **Daily cap** (default 20, editable in settings): due reviews first, then new cards. New cards from a part activated *today* may exceed the cap; other new cards only fill the remaining slots.
- The study day rolls over at 04:00. Buttons: Znovu / Obtížné / Dobré / Jednoduché. Keyboard: `Space` flips (and rates *Dobré* when flipped), `1`–`4` rate, `Esc` leaves.
- Scheduler: FSRS-5 with default parameters, 90 % target retention, learning steps 1/10 min, relearning step 10 min (`js/fsrs.js`).
- Card browser (*Karty a postup* on each package): per-part progress bars, search and filters by part, type and mastery.
- Stats: streak, last 14 days, and mastery bars (locked / new / learning / young / mature = next review ≥ 21 days away) overall and per package.

## Progress export / import

The *Exportovat postup* button (home screen and settings) downloads a JSON file:

```json
{ "app": "bio_karticky", "version": 1, "exportedAt": "…", "settings": { "extra": true, "permanent": true, "dailyCap": 20, "parts": { "bakterie/1": { "active": true, "activatedDay": 20381 } } }, "progress": { "bakterie/b01": { "st": 2, "s": 3.17, "d": 5.28, "due": 0, "last": 0, "step": 0, "reps": 2, "lapses": 0 } }, "log": [[1760000000000, "bakterie/b01", 3]] }
```

It contains settings and FSRS state keyed by `package/card id`, never card text, so it stays valid when the CSVs change. Importing replaces local data. The app warns users that browser data can be wiped and reminds them after 7 days without an export.

## Anki

```sh
npm run anki     # → out/anki/<package>.txt
```

Import the `.txt` files via *File → Import* in Anki. Each card gets a stable GUID (re-importing updates instead of duplicating), a deck `Bio kartičky::<Package>::<Part>`, the `Basic` note type, and tags `balicek_…`, `cast_N`, `typ_…` plus the CSV tags. Newlines become `<br>`.

## Project layout

```
index.html, css/style.css
js/app.js        UI (tabs, study session, settings dialog)
js/fsrs.js       FSRS-5 scheduling
js/scheduler.js  study pool + daily queue
js/store.js      localStorage, export/import
js/stats.js      streak and mastery stats
js/cards.js, js/csv.js, js/data.js   CSV → cards, loading
data/            packages.json + CSV files
tools/to_anki.js CSV → Anki export
sw.js, manifest.webmanifest, icons/   offline / installable PWA
```

Tauri wrapper: not yet. The app is plain static files, so `frontendDist` can point at this folder later.
