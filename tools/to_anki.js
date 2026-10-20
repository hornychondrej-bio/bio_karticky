#!/usr/bin/env node
// Converts the app's card CSVs into Anki-importable text files (one per package).
// Usage: node tools/to_anki.js [outDir]   (default: out/anki)
// In Anki: File > Import > pick the .txt file. The GUID column makes re-imports update cards instead of duplicating them.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardsFromCsv } from '../js/cards.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? join(root, 'out', 'anki');
const manifest = JSON.parse(readFileSync(join(root, 'data', 'packages.json'), 'utf8'));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Tab-separated, HTML mode on: tabs become spaces, newlines become <br>.
const field = (s) => escapeHtml(s).replace(/\t/g, ' ').replace(/\n/g, '<br>');
const tag = (s) => s.replace(/\s+/g, '_');

mkdirSync(outDir, { recursive: true });

for (const pkg of manifest.packages) {
  const cards = cardsFromCsv(pkg.id, readFileSync(join(root, 'data', pkg.file), 'utf8'));
  const partTitles = new Map((pkg.parts ?? []).map((p) => [p.n, p.title]));
  const lines = [
    '#separator:tab',
    '#html:true',
    '#guid column:1',
    '#notetype column:2',
    '#deck column:3',
    '#tags column:6',
  ];
  for (const c of cards) {
    const deck = `Bio kartičky::${pkg.title}::${c.part}. ${partTitles.get(c.part) ?? `Část ${c.part}`}`;
    const tags = [`balicek_${tag(pkg.id)}`, `cast_${c.part}`, `typ_${c.type}`, ...c.tags.map(tag)].join(' ');
    lines.push([`bio_karticky:${c.key}`, 'Basic', field(deck), field(c.front), field(c.back), tags].join('\t'));
  }
  const file = join(outDir, `${pkg.id}.txt`);
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`${file}: ${cards.length} cards`);
}
