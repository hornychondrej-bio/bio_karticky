# Bio kartičky (`bio_karticky`)

A static, dependency-free flashcard web app with [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) spaced repetition, made for high-school students and mobile use. The UI is in Czech; code and comments are in English.

- Cards live in **CSV files** served next to the app (GitHub Pages). Nothing is imported by students.
- Student **progress lives in the browser** (`localStorage`) and can be exported/imported as a JSON file.
- Vanilla HTML/CSS/JS with ES modules. No build step, no runtime dependencies, no CDN. Works offline as an installable PWA.
- Cards can be exported to Anki, and there is a guide for generating the CSVs with an AI.

## Contents

1. [Quick start](#quick-start)
2. [Concepts: packages, parts, card types](#concepts-packages-parts-card-types)
3. [Using the app](#using-the-app)
4. [Adding and editing cards](#adding-and-editing-cards)
5. [Creating cards with AI](#creating-cards-with-ai)
6. [Progress export / import](#progress-export--import)
7. [Anki export](#anki-export)
8. [Deploy to GitHub Pages](#deploy-to-github-pages)
9. [PWA, offline use and browsers](#pwa-offline-use-and-browsers)
10. [Configuration and internals](#configuration-and-internals)
11. [Project layout](#project-layout)
12. [Limitations](#limitations)
13. [Troubleshooting](#troubleshooting)

## Quick start

```sh
npm start        # = npx serve .  → open the printed URL
npm run validate # check data/packages.json and all card CSVs
npm run anki     # export the cards to Anki files in out/anki/
```

Node is only needed for these helper commands; the app itself is plain static files. It must be served over http(s) – opening `index.html` from disk does not work because of ES modules and `fetch`. Any static server works (`python3 -m http.server`, `npx serve`, …).

## Concepts: packages, parts, card types

```
package (a lesson/topic, one CSV file, e.g. "Bakterie")
└── part 1, 2, 3 …   (unlocked manually by the student, no gates)
    └── cards of three types: standard · extra · permanent
```

| type | studied when |
|------|--------------|
| `standard` | its part is **active** |
| `extra` | its part is active **and** *Extra karty* is on (optional harder material) |
| `permanent` | *Trvalé karty* is on **and** its part was activated at least once – they stay in study even after the part is switched off again |

The set of cards that are currently studied is called the **study pool**. Example: with Bakterie parts 1 and 2 on, part 3 off, extras off and permanents on, the pool is the standard cards of parts 1–2 plus the permanent cards of parts 1–2. Part 3's cards (including its permanent ones) stay out until part 3 is switched on for the first time.

Switching a part off never deletes progress; switching it on again resumes where the student left off.

## Using the app

### Tabs

- **Dnes** – today's summary (cards done, cards in the queue, streak), the **Začít studium** button, and the always-visible backup banner with the **Exportovat postup** button. The banner turns amber if the student has never exported or last exported 7+ days ago.
- **Balíčky** – general switches (*Extra karty*, *Trvalé karty*), a search box, and the decks. Each deck is a collapsible row (collapsed by default) with a quick **Studovat (N)** button, so one package can be studied on its own. Opening a deck shows its mastery bar, the part switches (with card counts per type), **Studovat jen tento balíček**, and **Karty a postup**.
  - The search box matches package titles, descriptions and part titles, ignoring case and diacritics; matching decks open automatically.
  - **Karty a postup** opens the card browser: progress bars per part, search, filters by part / type / mastery, and each card's answer and next review. The browser lists *all* cards of the package, including those currently out of study.
- **Statistiky** – streak (current and longest), reviews of the last 14 days, and the mastery bars.
- **⚙ (top right)** – settings dialog: daily limit, theme (system / light / dark), export, import and *Smazat veškerý postup*.

### Studying

- Tap the card (or **Zobrazit odpověď**) to flip it, then pick a button: **Znovu / Obtížné / Dobré / Jednoduché**. Each button shows the next interval.
- Keyboard: `Space`/`Enter` flips and, once flipped, rates *Dobré*; `1`–`4` rate; `Esc` leaves the session.
- Cards in (re)learning steps (e.g. after *Znovu*) return a few cards later within the same session.

### The daily queue

Order: learning cards due within 20 minutes → due reviews → new cards.

- The **daily cap** (default 20, editable in settings) counts distinct cards rated during the current study day. Due reviews fill it first; new cards only use the remaining slots.
- **Overflow:** new cards from a part that was activated *today* ignore the cap, so switching on a new part lets the student start it right away. The day after, they fall under the normal cap.
- A **study day** rolls over at 04:00 local time.

### Mastery levels (statistics)

Statistics describe **what the student is studying now**: only cards in the study pool are counted, so switching a part off removes its cards from the bars (their progress is kept). The card browser is the exception and also shows cards outside the pool as *Mimo studium*.

| level | meaning |
|-------|---------|
| Nové | in the pool, never rated |
| Učím se | in learning/relearning steps (short intervals) |
| Mladé | review card whose next review is less than 21 days away |
| Zvládnuté | review card whose next review is 21 or more days away |

The streak, the 14-day chart and the total review count are history and are not affected by which parts are active.

## Adding and editing cards

1. Put a CSV into `data/`.
2. Register it in `data/packages.json`:

```json
{
  "packages": [
    {
      "id": "bakterie",
      "title": "Bakterie",
      "description": "Stavba, rozmnožování a význam bakterií.",
      "file": "bakterie.csv",
      "parts": [
        { "n": 1, "title": "Stavba bakteriální buňky" },
        { "n": 2, "title": "Rozmnožování a metabolismus" }
      ]
    }
  ]
}
```

   `id` must be lowercase ASCII, unique and **never change** (it is part of the progress key). Part titles are optional; without them the app shows "Část N". The order of the packages in the file is the order in the app.
3. Run `npm run validate`, then push (see [Deploy](#deploy-to-github-pages)).

### CSV format

UTF-8, header row required, delimiter (`,` `;` or tab) auto-detected, fields containing the delimiter, quotes or line breaks must be quoted (`""` for a literal quote). Anki-style `#` lines at the top are ignored. Card text is **plain text**; line breaks are shown as written. HTML/Markdown is not interpreted.

| column  | required | meaning |
|---------|----------|---------|
| `id`    | yes | Unique within the package. Progress is stored per `package/id`. |
| `front` | yes | Question |
| `back`  | yes | Answer |
| `part`  | no  | Positive integer, default 1. The part the student unlocks. Parts should be contiguous (1, 2, 3, …). |
| `type`  | no  | `standard` (default), `permanent` or `extra` (the Czech words `standardní`, `trvalá` are also accepted) |
| `tags`  | no  | Space-separated; used in the Anki export (and by the AI guide to record which learning outcome a card serves) |

Rows without `id` or `front` are skipped; a duplicate `id` is skipped with a console warning. `npm run validate` reports all of these properly.

### Editing safely (students already have progress)

- **Never change or reuse an `id`.** Fixing a typo in `front`/`back` keeps the progress.
- New cards: use new ids. They appear as *new* cards when their part is in the pool.
- Deleting a row: the card disappears; its stored progress is ignored (and harmless).
- Changing `part` or `type` moves the card in/out of the pool according to the rules above; progress is kept.
- Changes reach students on their next online visit (see [PWA](#pwa-offline-use-and-browsers)).

## Creating cards with AI

[`docs/AI_CARD_AUTHORING.md`](docs/AI_CARD_AUTHORING.md) is a ready-to-use guide: give it to an AI together with the course material and ask it to follow the guide. It makes the AI:

- use the learning outcomes (**„Cíle“**) as the backbone and break vague outcomes into concrete cards (e.g. "charakterizovat tři nemoci" → cards for five diseases plus one overview card),
- treat material wrapped in `&&…&&` (or `@@…@@`) as `extra`,
- tag every card with the outcome it serves, pick a small set of `permanent` cards, and write atomic Czech plain-text cards,
- deliver the CSV, the `packages.json` entry, and a coverage report (outcome → cards, gaps, judgement calls).

Always run `npm run validate` on the result and review the coverage report before publishing.

## Progress export / import

**Exportovat postup** (home banner and settings dialog) downloads `bio_karticky_postup_<date>.json`; **Importovat postup** (settings) loads such a file and **replaces** all local data after a confirmation. Format:

```json
{
  "app": "bio_karticky",
  "version": 1,
  "exportedAt": "2026-10-20T18:00:00.000Z",
  "settings": {
    "extra": true, "permanent": true, "dailyCap": 20, "theme": "auto", "lastExport": 1792000000000,
    "parts": { "bakterie/1": { "active": true, "activatedDay": 20381 } }
  },
  "progress": {
    "bakterie/b01": { "st": 2, "s": 3.17, "d": 5.28, "due": 1792720800000, "last": 1792516762404, "step": 0, "reps": 2, "lapses": 0 }
  },
  "log": [[1792516762404, "bakterie/b01", 3]]
}
```

- `settings` comes first and holds the active parts, the extra/permanent switches, the daily cap, and the theme.
- `progress` is the FSRS state keyed by `package/card id` (`st`: 0 new, 1 learning, 2 review, 3 relearning; `s` stability, `d` difficulty, `due`/`last` timestamps in ms).
- `log` is the review history `[timestamp, card key, grade 1–4]` (the newest 30 000 entries are kept); it feeds the streak and the activity chart.
- **No card text** is in the file, so an export stays valid when the CSVs change.

Why it matters: browser data can be cleared at any time (cleared site data, storage pressure, switching browser or device). The app says so in the banner and reminds after 7 days. Export is also the only way to move progress between devices.

## Anki export

```sh
npm run anki     # → out/anki/<package>.txt   (or: node tools/to_anki.js <outDir>)
```

In Anki: *File → Import* and pick the `.txt` file. The files use Anki's text-file header directives:

- stable **GUID** per card (`bio_karticky:<package>/<id>`), so re-importing updates cards instead of duplicating them,
- **deck** `Bio kartičky::<Package>::<N>. <Part title>`, note type **Basic**,
- **tags** `balicek_<package>`, `cast_<N>`, `typ_<type>` plus the CSV tags,
- HTML mode on: text is escaped and line breaks become `<br>`.

Anki's own scheduling is separate; progress is not transferred in either direction.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to `main`.
2. In *Settings → Pages* set **Source: GitHub Actions**. `.github/workflows/pages.yml` publishes the repository root on every push to `main`.
3. The app uses relative URLs, so it works from a project sub-path like `https://<user>.github.io/<repo>/`.

Editing a CSV and pushing is the whole content-update workflow.

## PWA, offline use and browsers

- `manifest.webmanifest` + PNG/SVG icons make the app installable (Chromium on desktop/Android, "Add to Home Screen" on iOS and Firefox for Android).
- `sw.js` precaches the app shell plus `data/packages.json` and every CSV it lists when it installs, so the **first visit already works offline**.
- Strategy: **network-first with a 4 s timeout**, falling back to the cache. New CSVs/app versions arrive on the next online load; slow connections do not block the app.
- Cache name `bio-karticky-v2` in `sw.js`. If you add or rename app files (new JS module, icon), update the `SHELL` list and bump the version.
- **Progress is per browser profile and per origin.** An installed iOS home-screen app has storage separate from Safari, so progress made in one does not appear in the other (use export/import). Safari may also clear a site's storage after about a week of non-use. Private/incognito windows disable the service worker in Firefox and discard `localStorage` on close.
- Testing: Chromium → DevTools → *Application* (manifest, service worker, offline). Firefox desktop can run the app and its service worker (`about:debugging#/runtime/this-firefox`) but cannot install PWAs.

## Configuration and internals

Most behaviour is controlled by a few named constants:

| what | where |
|------|-------|
| FSRS weights, 90 % target retention, learning steps (1, 10 min) and relearning step (10 min) | `js/fsrs.js` |
| Day rollover hour (04:00) | `js/time.js` |
| "Mature" threshold (21 days) | `js/stats.js` (`MATURE_INTERVAL_DAYS`) |
| Look-ahead for learning cards (20 min) | `js/scheduler.js` |
| Export reminder (7 days) | `js/app.js` (`EXPORT_REMINDER_DAYS`) |
| Review-log size (30 000 entries) | `js/store.js` (`MAX_LOG`) |
| Default daily cap and switches | `js/store.js` (`defaultSettings`) |

FSRS-5 is implemented from scratch with the default parameters (no optimizer, no fuzz); intervals are forced to be ordered Hard < Good < Easy.

localStorage keys: `bio_karticky_v1` (settings + progress) and `bio_karticky_log_v1` (review log).

## Project layout

```
index.html, css/style.css
js/app.js         UI: tabs, study session, card browser, settings dialog
js/fsrs.js        FSRS-5 scheduling and interval labels
js/scheduler.js   study pool rules + daily queue
js/store.js       localStorage, export/import, reset
js/stats.js       mastery levels, streaks, activity
js/time.js        study-day helpers (04:00 rollover)
js/cards.js       CSV rows → cards (shared with tools/)
js/csv.js         CSV parser (delimiter detection, quoting)
js/data.js        loads packages.json and the CSVs
data/             packages.json + card CSVs
docs/             AI_CARD_AUTHORING.md
tools/            to_anki.js (Anki export), validate_cards.js
sw.js, manifest.webmanifest, icons/    PWA
.github/workflows/pages.yml            GitHub Pages deployment
```

A Tauri wrapper is not set up yet. The app is plain static files, so Tauri's `frontendDist` can point at this folder later; that has not been tried, so loading the CSVs and the service worker there are untested.

## Limitations

- Plain-text cards only: no images, HTML, Markdown, cloze deletions or reversed cards.
- The UI is Czech only.
- No undo for a rating, no editing cards inside the app (edit the CSVs).
- No accounts or sync: progress is per browser and moves between devices only via export/import. `localStorage` holds roughly 5 MB; the review log is capped for that reason.
- FSRS parameters are not personalised.
- There are no automated tests; `npm run validate` covers the card data.

## Troubleshooting

| symptom | cause / fix |
|---------|-------------|
| Blank page or "Seznam balíčků se nepodařilo načíst" | Not served over http(s), or `data/packages.json` is missing/invalid. Run `npm start` and `npm run validate`. |
| Old version keeps showing after a deploy | The service worker served a cached file. Reload once more, or *DevTools → Application → Service Workers → Unregister* (Firefox: `about:debugging`) and hard-reload. |
| A package shows an error banner | Its CSV could not be loaded; the other packages still work. Check the `file` path in `packages.json`. |
| New part's cards do not appear | The part must be switched on in *Balíčky*; extra cards also need *Extra karty* on; check the daily cap (cards beyond it wait until tomorrow, except new cards from a part activated today). |
| Progress disappeared | Browser data was cleared, or a different browser/profile/installed app is used. Import the latest export. |
| "Nepodařilo se uložit data" | `localStorage` is full or blocked (private window). Export the progress. |
