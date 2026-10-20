// Turns parsed CSV rows into card objects. Shared by the web app and tools/to_anki.js.
import { parseCsv } from './csv.js';

export const TYPES = ['standard', 'permanent', 'extra'];

const TYPE_ALIASES = {
  standard: 'standard',
  standardni: 'standard',
  permanent: 'permanent',
  trvala: 'permanent',
  extra: 'extra',
};

function normalizeType(raw) {
  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return TYPE_ALIASES[key] ?? 'standard';
}

/** Required CSV columns: id, front, back. Optional: part (integer, default 1), type, tags. */
export function cardsFromCsv(pkgId, text) {
  const cards = [];
  const seen = new Set();
  for (const row of parseCsv(text)) {
    if (!row.id || !row.front) continue;
    if (seen.has(row.id)) {
      console.warn(`[${pkgId}] duplicate card id "${row.id}" skipped`);
      continue;
    }
    seen.add(row.id);
    const part = parseInt(row.part, 10);
    cards.push({
      key: `${pkgId}/${row.id}`,
      pkg: pkgId,
      id: row.id,
      front: row.front,
      back: row.back ?? '',
      part: Number.isFinite(part) && part > 0 ? part : 1,
      type: normalizeType(row.type ?? ''),
      tags: (row.tags ?? '').split(/\s+/).filter(Boolean),
      order: cards.length,
    });
  }
  return cards;
}
