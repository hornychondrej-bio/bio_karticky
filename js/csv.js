// Minimal CSV parser: UTF-8 BOM, quoted fields with embedded newlines/quotes,
// auto-detected delimiter (tab, semicolon, comma), Anki-style leading "#" directive lines.

function detectDelimiter(line) {
  let best = ',';
  let bestCount = -1;
  for (const d of ['\t', ';', ',']) {
    let count = 0;
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseRows(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  while (lines.length && (lines[0].startsWith('#') || lines[0].trim() === '')) lines.shift();
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const src = lines.join('\n');

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Parses CSV text with a header row into an array of objects keyed by lower-case header. */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}
