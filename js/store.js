// Persistent state in localStorage: settings + per-card FSRS progress, and an append-only review log.
import { dayIndex } from './time.js';

const KEY = 'bio_karticky_v1';
const LOG_KEY = 'bio_karticky_log_v1';
const MAX_LOG = 30000;
export const APP_ID = 'bio_karticky';
export const EXPORT_VERSION = 1;

const defaultSettings = () => ({
  extra: true,
  permanent: true,
  dailyCap: 20,
  theme: 'auto',
  lastExport: 0,
  // "pkg/part" -> { active: boolean, activatedDay: study-day index of the last activation }.
  // An entry that exists means the part was activated at least once (permanent cards stay in study).
  parts: {},
});

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const saved = read(KEY, {});
export const store = {
  settings: { ...defaultSettings(), ...(saved.settings ?? {}) },
  progress: saved.progress ?? {},
  log: read(LOG_KEY, []), // entries: [timestamp, cardKey, grade]
  saveError: false,
};

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    store.saveError = false;
  } catch {
    store.saveError = true;
  }
}

export function save() {
  write(KEY, { settings: store.settings, progress: store.progress });
}

export function recordReview(cardKey, nextState, grade, now) {
  store.progress[cardKey] = nextState;
  store.log.push([now, cardKey, grade]);
  if (store.log.length > MAX_LOG) store.log.splice(0, store.log.length - MAX_LOG);
  write(LOG_KEY, store.log);
  save();
}

/** Keys of cards rated during the current study day. */
export function doneToday(now = Date.now()) {
  const today = dayIndex(now);
  const done = new Set();
  for (let i = store.log.length - 1; i >= 0 && dayIndex(store.log[i][0]) === today; i--) {
    done.add(store.log[i][1]);
  }
  return done;
}

export function setPartActive(pkgId, part, active, now = Date.now()) {
  const key = `${pkgId}/${part}`;
  const entry = store.settings.parts[key] ?? { active: false, activatedDay: -1 };
  if (active && !entry.active) entry.activatedDay = dayIndex(now);
  entry.active = active;
  store.settings.parts[key] = entry;
  save();
}

export function exportData() {
  store.settings.lastExport = Date.now();
  save();
  return {
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: store.settings,
    progress: store.progress,
    log: store.log,
  };
}

/** Replaces all local data with the imported file. Throws on an invalid file. */
export function importData(data) {
  if (!data || data.app !== APP_ID || typeof data.progress !== 'object' || typeof data.settings !== 'object') {
    throw new Error('Soubor není platný export aplikace Bio kartičky.');
  }
  if (data.version > EXPORT_VERSION) throw new Error('Soubor pochází z novější verze aplikace.');
  store.settings = { ...defaultSettings(), ...data.settings };
  store.progress = data.progress;
  store.log = Array.isArray(data.log) ? data.log : [];
  write(LOG_KEY, store.log);
  save();
}

export function resetAll() {
  store.settings = defaultSettings();
  store.progress = {};
  store.log = [];
  write(LOG_KEY, store.log);
  save();
}
