#!/usr/bin/env node
// Validates data/packages.json and every card CSV. Exit code 1 if there are errors (warnings do not fail).
// Usage: node tools/validate_cards.js
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRows } from '../js/csv.js';
import { TYPES } from '../js/cards.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'data', 'packages.json'), 'utf8'));
const MAX_FIELD = 400;

let errors = 0;
let warnings = 0;
const fail = (pkg, msg) => { errors++; console.error(`ERROR   [${pkg}] ${msg}`); };
const warn = (pkg, msg) => { warnings++; console.warn(`warning [${pkg}] ${msg}`); };

const ids = new Set();
for (const entry of manifest.packages ?? []) {
  const pkg = entry.id ?? '(no id)';
  if (!entry.id || !/^[a-z0-9_]+$/.test(entry.id)) fail(pkg, 'package id must be lowercase ASCII letters, digits or _');
  if (ids.has(entry.id)) fail(pkg, 'duplicate package id');
  ids.add(entry.id);
  if (!entry.title) fail(pkg, 'missing title');

  const path = join(root, 'data', entry.file ?? '');
  if (!entry.file || !existsSync(path)) {
    fail(pkg, `CSV file not found: data/${entry.file}`);
    continue;
  }

  const rows = parseRows(readFileSync(path, 'utf8'));
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  for (const col of ['id', 'front', 'back']) if (!header.includes(col)) fail(pkg, `missing required column "${col}"`);
  const col = (row, name) => (row[header.indexOf(name)] ?? '').trim();

  const seen = new Set();
  const fronts = new Map();
  const parts = new Set();
  const counts = { standard: 0, extra: 0, permanent: 0 };

  rows.forEach((row, i) => {
    const line = `row ${i + 2}`;
    if (row.length !== header.length) fail(pkg, `${line}: expected ${header.length} columns, found ${row.length} (unquoted comma?)`);
    const id = col(row, 'id');
    if (!id) return fail(pkg, `${line}: empty id`);
    if (seen.has(id)) fail(pkg, `${line}: duplicate id "${id}"`);
    seen.add(id);
    const front = col(row, 'front');
    if (!front) fail(pkg, `${id}: empty front`);
    if (!col(row, 'back')) fail(pkg, `${id}: empty back`);
    if (/&&|@@/.test(`${front}${col(row, 'back')}`)) fail(pkg, `${id}: leftover && / @@ marker`);
    if (/<[a-z/][^>]*>|\*\*|^#/m.test(`${front}${col(row, 'back')}`)) warn(pkg, `${id}: looks like HTML/Markdown, cards are plain text`);
    if (front.length > MAX_FIELD || col(row, 'back').length > MAX_FIELD) warn(pkg, `${id}: very long text, consider splitting into atomic cards`);
    if (fronts.has(front)) warn(pkg, `${id}: same front as ${fronts.get(front)}`);
    fronts.set(front, id);

    if (header.includes('part')) {
      const part = col(row, 'part');
      if (!/^[1-9]\d*$/.test(part)) fail(pkg, `${id}: part "${part}" is not a positive integer`);
      else parts.add(Number(part));
    }
    const type = col(row, 'type') || 'standard';
    if (!TYPES.includes(type)) fail(pkg, `${id}: unknown type "${type}" (use ${TYPES.join(', ')})`);
    else counts[type]++;
  });

  const sorted = [...parts].sort((a, b) => a - b);
  if (sorted.some((n, i) => n !== i + 1)) warn(pkg, `parts are not contiguous from 1: ${sorted.join(', ')}`);
  const declared = (entry.parts ?? []).map((p) => p.n);
  for (const n of sorted) if (!declared.includes(n)) warn(pkg, `part ${n} has cards but no title in packages.json`);
  for (const n of declared) if (!parts.has(n)) warn(pkg, `packages.json lists part ${n} but no card uses it`);
  const permanentShare = seen.size ? counts.permanent / seen.size : 0;
  if (permanentShare > 0.2) warn(pkg, `${Math.round(permanentShare * 100)} % of the cards are permanent (recommended 5–15 %)`);

  console.log(`${pkg}: ${seen.size} cards (${counts.standard} standard, ${counts.extra} extra, ${counts.permanent} permanent), parts: ${sorted.join(', ') || '-'}`);
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
