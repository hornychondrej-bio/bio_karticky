// Loads the static package manifest and card CSVs (served from the same origin / GitHub Pages).
import { cardsFromCsv } from './cards.js';

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Returns { packages, errors }. A failing CSV does not prevent the other packages from loading. */
export async function loadPackages() {
  const manifest = JSON.parse(await fetchText('data/packages.json'));
  const errors = [];
  const packages = [];
  for (const entry of manifest.packages ?? []) {
    try {
      const cards = cardsFromCsv(entry.id, await fetchText(`data/${entry.file}`));
      const partNumbers = [...new Set(cards.map((c) => c.part))].sort((a, b) => a - b);
      const titles = new Map((entry.parts ?? []).map((p) => [p.n, p.title]));
      packages.push({
        id: entry.id,
        title: entry.title ?? entry.id,
        description: entry.description ?? '',
        cards,
        parts: partNumbers.map((n) => ({ n, title: titles.get(n) ?? `Část ${n}` })),
      });
    } catch (err) {
      errors.push(`Balíček „${entry.id}“ se nepodařilo načíst (${err.message}).`);
    }
  }
  return { packages, errors };
}
