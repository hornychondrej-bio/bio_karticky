// UI: tabs (Dnes / Balíčky / Statistiky), study session, settings dialog.
import { loadPackages } from './data.js';
import { store, save, recordReview, doneToday, setPartActive, exportData, importData, resetAll } from './store.js';
import { schedule, previewLabels } from './fsrs.js';
import { buildQueue } from './scheduler.js';
import { MASTERY, MATURE_INTERVAL_DAYS, masteryOf, masteryCounts, streaks, recentActivity } from './stats.js';
import { DAY, dayIndex } from './time.js';

const EXPORT_REMINDER_DAYS = 7;
const GRADES = [
  { g: 1, name: 'Znovu', cls: 'again' },
  { g: 2, name: 'Obtížné', cls: 'hard' },
  { g: 3, name: 'Dobré', cls: 'good' },
  { g: 4, name: 'Jednoduché', cls: 'easy' },
];
const TYPE_LABELS = { standard: 'standardní', permanent: 'trvalé', extra: 'extra' };
const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

let packages = [];
let loadErrors = [];
let tab = 'today';
let session = null;

const root = document.getElementById('app');

/** Tiny DOM builder. Text is always inserted as text nodes (no HTML injection from CSV data). */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value' || k === 'disabled') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const cardsWord = (n) => plural(n, 'karta', 'karty', 'karet');
const allCards = () => packages.flatMap((p) => p.cards);

function applyTheme() {
  const t = store.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------------------------------------------------------------- export / import

function downloadExport() {
  const blob = new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `bio_karticky_postup_${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  render();
}

function pickImport() {
  const input = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    onchange: async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!confirm('Import nahradí veškerý postup a nastavení v tomto prohlížeči. Pokračovat?')) return;
        importData(data);
        applyTheme();
        closeSettings();
        render();
      } catch (err) {
        alert(err.message || 'Soubor se nepodařilo načíst.');
      }
    },
  });
  input.click();
}

function exportBanner() {
  const last = store.settings.lastExport;
  const days = last ? Math.floor((Date.now() - last) / DAY) : null;
  const stale = days === null || days >= EXPORT_REMINDER_DAYS;
  const status = days === null ? 'Postup jste zatím neexportovali.' : days === 0 ? 'Naposledy exportováno dnes.' : `Naposledy exportováno před ${plural(days, 'dnem', 'dny', 'dny')}.`;
  return h(
    'section',
    { class: `banner${stale ? ' stale' : ''}` },
    h('p', null, 'Postup je uložen jen v tomto prohlížeči a může být kdykoli smazán. Pravidelně ho exportujte. ', h('span', { class: 'muted' }, status)),
    h('button', { class: 'btn', onclick: downloadExport }, 'Exportovat postup'),
  );
}

// ---------------------------------------------------------------- views

function viewToday() {
  const { queue, counts } = buildQueue(packages);
  const done = doneToday().size;
  const { current } = streaks();
  const hasActive = Object.values(store.settings.parts).some((p) => p.active);

  const summary = h(
    'section',
    { class: 'card summary' },
    h('div', { class: 'stat-row' }, stat(done, 'dnes hotovo'), stat(queue.length, 've frontě'), stat(current, current === 1 ? 'den v řadě' : 'dní v řadě')),
    queue.length
      ? h(
          'p',
          { class: 'muted' },
          [counts.learning + counts.due && `Opakování: ${counts.learning + counts.due}`, counts.fresh && `Nové: ${counts.fresh}`].filter(Boolean).join(' · '),
        )
      : h('p', { class: 'muted' }, hasActive ? 'Na dnes je hotovo. Přijďte zase zítra.' : 'Nejdřív si v záložce Balíčky zapněte alespoň jednu část.'),
    h('button', { class: 'btn primary big', disabled: !queue.length, onclick: () => startSession(null) }, queue.length ? 'Začít studium' : 'Nic k učení'),
  );

  return [exportBanner(), summary, errorsBox()];
}

const stat = (value, caption) => h('div', { class: 'stat' }, h('strong', null, String(value)), h('span', null, caption));

function errorsBox() {
  return loadErrors.length || store.saveError
    ? h('section', { class: 'banner error' }, ...loadErrors.map((e) => h('p', null, e)), store.saveError && h('p', null, 'Nepodařilo se uložit data do prohlížeče (plné úložiště?). Exportujte postup.'))
    : null;
}

function viewDecks() {
  const s = store.settings;
  const toggle = (label, hint, key) =>
    h(
      'label',
      { class: 'row switch' },
      h('span', null, h('strong', null, label), h('small', { class: 'muted' }, hint)),
      h('input', {
        type: 'checkbox',
        checked: s[key],
        onchange: (e) => {
          s[key] = e.target.checked;
          save();
        },
      }),
    );

  const general = h(
    'section',
    { class: 'card' },
    h('h2', null, 'Obecná nastavení'),
    toggle('Extra karty', 'Náročnější karty navíc k aktivním částem', 'extra'),
    toggle('Trvalé karty', 'Zůstávají ve studiu, i když část vypnete', 'permanent'),
  );

  const decks = packages.map((pkg) => {
    const counts = masteryCounts(pkg.cards);
    return h(
      'section',
      { class: 'card' },
      h('h2', null, pkg.title),
      pkg.description && h('p', { class: 'muted' }, pkg.description),
      masteryBar(counts),
      ...pkg.parts.map((part) => {
        const cards = pkg.cards.filter((c) => c.part === part.n);
        const n = (type) => cards.filter((c) => c.type === type).length;
        const entry = s.parts[`${pkg.id}/${part.n}`];
        return h(
          'label',
          { class: 'row switch' },
          h(
            'span',
            null,
            h('strong', null, `${part.n}. ${part.title}`),
            h('small', { class: 'muted' }, `${cardsWord(cards.length)}: standardní ${n('standard')} · extra ${n('extra')} · trvalé ${n('permanent')}`),
          ),
          h('input', {
            type: 'checkbox',
            checked: entry?.active,
            onchange: (e) => {
              setPartActive(pkg.id, part.n, e.target.checked);
              render();
            },
          }),
        );
      }),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => startSession(pkg.id) }, 'Studovat jen tento balíček'),
        h('button', { class: 'btn', onclick: () => openBrowser(pkg) }, 'Karty a postup'),
      ),
    );
  });

  return [general, ...decks, errorsBox()];
}

function masteryBar(counts, legend = true) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return h(
    'div',
    { class: 'mastery' },
    h(
      'div',
      { class: 'bar', role: 'img', 'aria-label': MASTERY.map((m) => `${m.label}: ${counts[m.id]}`).join(', ') },
      MASTERY.filter((m) => counts[m.id]).map((m) => h('span', { class: `seg ${m.id}`, style: `width:${(counts[m.id] / total) * 100}%` })),
    ),
    legend && h('ul', { class: 'legend' }, MASTERY.map((m) => h('li', null, h('i', { class: `dot ${m.id}` }), `${m.label} ${counts[m.id]}`))),
  );
}

function viewStats() {
  const { current, longest } = streaks();
  const activity = recentActivity(14);
  const max = Math.max(1, ...activity.map((a) => a.count));
  const total = store.log.length;

  return [
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Série'),
      h('div', { class: 'stat-row' }, stat(current, 'aktuální série'), stat(longest, 'nejdelší série'), stat(total, 'opakování celkem')),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Posledních 14 dní'),
      h(
        'div',
        { class: 'activity' },
        activity.map((a) =>
          h(
            'div',
            { class: 'day', title: `${a.count}` },
            h('span', { class: 'count' }, a.count ? String(a.count) : ''),
            h('div', { class: 'col', style: `height:${(a.count / max) * 100}%` }),
            h('span', { class: 'wd' }, WEEKDAYS[a.date.getUTCDay()]),
          ),
        ),
      ),
    ),
    h('section', { class: 'card' }, h('h2', null, 'Zvládnutí karet – celkem'), masteryBar(masteryCounts(allCards())), masteryHelp()),
    ...packages.map((pkg) => h('section', { class: 'card' }, h('h2', null, pkg.title), masteryBar(masteryCounts(pkg.cards)))),
  ];
}

const masteryHelp = () =>
  h('p', { class: 'muted help' }, `Zamčené: část ještě nebyla zapnuta. Nové: ještě nezkoušené. Učím se: v krátkých krocích. Mladé: další opakování za méně než ${MATURE_INTERVAL_DAYS} dní. Zvládnuté: další opakování za ${MATURE_INTERVAL_DAYS} a více dní.`);

// ---------------------------------------------------------------- card browser

const browser = document.getElementById('browser');

function dueText(card) {
  const level = masteryOf(card);
  if (level === 'locked') return 'zamčená (část nebyla zapnuta)';
  const p = store.progress[card.key];
  if (!p || p.st === 0) return 'nová';
  if (p.st !== 2) return 'učí se';
  const days = dayIndex(p.due) - dayIndex(Date.now());
  return days <= 0 ? 'k opakování dnes' : `další opakování za ${days} d`;
}

function openBrowser(pkg) {
  const list = h('div', { class: 'card-list' });
  const search = h('input', { type: 'search', placeholder: 'Hledat v kartách…', 'aria-label': 'Hledat v kartách', oninput: refresh });
  const partSel = h('select', { 'aria-label': 'Část', onchange: refresh }, h('option', { value: '' }, 'Všechny části'), pkg.parts.map((p) => h('option', { value: p.n }, `${p.n}. ${p.title}`)));
  const typeSel = h('select', { 'aria-label': 'Typ', onchange: refresh }, h('option', { value: '' }, 'Všechny typy'), Object.entries(TYPE_LABELS).map(([v, t]) => h('option', { value: v }, t)));
  const levelSel = h('select', { 'aria-label': 'Zvládnutí', onchange: refresh }, h('option', { value: '' }, 'Všechna zvládnutí'), MASTERY.map((m) => h('option', { value: m.id }, m.label)));

  function refresh() {
    const q = search.value.trim().toLowerCase();
    const cards = pkg.cards.filter(
      (c) =>
        (!partSel.value || c.part === Number(partSel.value)) &&
        (!typeSel.value || c.type === typeSel.value) &&
        (!levelSel.value || masteryOf(c) === levelSel.value) &&
        (!q || `${c.front} ${c.back}`.toLowerCase().includes(q)),
    );
    list.replaceChildren(
      ...(cards.length
        ? cards.map((c) =>
            h(
              'details',
              null,
              h('summary', null, h('i', { class: `dot ${masteryOf(c)}` }), h('span', null, c.front)),
              h('div', { class: 'detail' }, c.back, h('small', { class: 'muted' }, `Část ${c.part} · ${TYPE_LABELS[c.type]} · ${dueText(c)}`)),
            ),
          )
        : [h('p', { class: 'muted' }, 'Žádné karty neodpovídají filtru.')]),
    );
  }

  browser.replaceChildren(
    h(
      'div',
      { class: 'browser-body' },
      h('div', { class: 'browser-head' }, h('h2', null, pkg.title), h('button', { class: 'icon-btn', 'aria-label': 'Zavřít', onclick: () => browser.close() }, '✕')),
      masteryBar(masteryCounts(pkg.cards)),
      h(
        'div',
        { class: 'part-progress' },
        pkg.parts.map((part) => h('div', null, h('div', { class: 'name' }, `${part.n}. ${part.title}`), masteryBar(masteryCounts(pkg.cards.filter((c) => c.part === part.n)), false))),
      ),
      masteryHelp(),
      h('div', { class: 'filters' }, search, partSel, typeSel, levelSel),
      list,
    ),
  );
  refresh();
  browser.showModal();
}

browser.addEventListener('click', (e) => { if (e.target === browser) browser.close(); });

// ---------------------------------------------------------------- study session

function startSession(onlyPkg) {
  const { queue } = buildQueue(packages, Date.now(), onlyPkg);
  if (!queue.length) return;
  session = { queue, remaining: new Set(queue.map((c) => c.key)), total: queue.length, revealed: false, rated: 0 };
  render();
}

function rate(g) {
  const card = session.queue[0];
  const now = Date.now();
  const next = schedule(store.progress[card.key], g, now);
  recordReview(card.key, next, g, now);
  session.queue.shift();
  session.rated++;
  if (next.st === 1 || next.st === 3) {
    // Still in (re)learning steps: show it again a few cards later in this session.
    session.queue.splice(Math.min(session.queue.length, 3), 0, card);
  } else session.remaining.delete(card.key);
  session.revealed = false;
  render();
}

function viewStudy() {
  const close = h('button', { class: 'icon-btn', 'aria-label': 'Ukončit studium', onclick: () => { session = null; render(); } }, '✕');

  if (!session.queue.length) {
    return h(
      'div',
      { class: 'study' },
      h('div', { class: 'study-top' }, close),
      h(
        'div',
        { class: 'study-done' },
        h('h2', null, 'Na dnes hotovo'),
        h('p', { class: 'muted' }, `Zodpovězeno: ${session.rated}. Série: ${plural(streaks().current, 'den', 'dny', 'dní')}.`),
        h('button', { class: 'btn primary', onclick: () => { session = null; render(); } }, 'Zpět'),
      ),
    );
  }

  const card = session.queue[0];
  const pkg = packages.find((p) => p.id === card.pkg);
  const part = pkg.parts.find((p) => p.n === card.part);
  const labels = previewLabels(store.progress[card.key], Date.now());
  const progress = (session.total - session.remaining.size) / session.total;

  return h(
    'div',
    { class: 'study' },
    h('div', { class: 'study-top' }, close, h('div', { class: 'progress' }, h('div', { style: `width:${progress * 100}%` })), h('span', { class: 'muted' }, `${session.remaining.size}`)),
    h(
      'div',
      { class: 'flashcard', onclick: () => { if (!session.revealed) { session.revealed = true; render(); } } },
      h('div', { class: 'meta' }, `${pkg.title} · ${part?.title ?? `část ${card.part}`}`, card.type !== 'standard' && h('span', { class: `badge ${card.type}` }, TYPE_LABELS[card.type])),
      h('div', { class: 'front' }, card.front),
      session.revealed && [h('hr'), h('div', { class: 'back' }, card.back)],
    ),
    session.revealed
      ? h('div', { class: 'grades' }, GRADES.map(({ g, name, cls }) => h('button', { class: `grade ${cls}`, onclick: () => rate(g) }, h('small', null, labels[g - 1]), name)))
      : h('div', { class: 'grades' }, h('button', { class: 'btn primary big', onclick: () => { session.revealed = true; render(); } }, 'Zobrazit odpověď')),
  );
}

document.addEventListener('keydown', (e) => {
  if (!session || !session.queue.length || document.querySelector('dialog[open]')) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!session.revealed) {
      session.revealed = true;
      render();
    } else rate(3);
  } else if (session.revealed && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key));
  else if (e.key === 'Escape') {
    session = null;
    render();
  }
});

// ---------------------------------------------------------------- settings dialog

const dialog = document.getElementById('settings');

function openSettings() {
  const s = store.settings;
  dialog.replaceChildren(
    h(
      'form',
      { method: 'dialog', class: 'settings-form' },
      h('h2', null, 'Nastavení'),
      h(
        'label',
        { class: 'field' },
        'Denní limit karet',
        h('input', {
          type: 'number',
          min: '1',
          max: '999',
          value: s.dailyCap,
          onchange: (e) => {
            s.dailyCap = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 20));
            e.target.value = s.dailyCap;
            save();
            render();
          },
        }),
        h('small', { class: 'muted' }, 'Opakování mají přednost. Nové karty z právě zapnuté části mohou limit překročit.'),
      ),
      h(
        'label',
        { class: 'field' },
        'Vzhled',
        h('select', { onchange: (e) => { s.theme = e.target.value; save(); applyTheme(); } },
          [['auto', 'Podle systému'], ['light', 'Světlý'], ['dark', 'Tmavý']].map(([v, t]) => h('option', { value: v, selected: s.theme === v }, t))),
      ),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: downloadExport }, 'Exportovat postup'), h('button', { type: 'button', class: 'btn', onclick: pickImport }, 'Importovat postup')),
      h('p', { class: 'muted' }, 'Export obsahuje nastavení a postup (ne text karet – ty se načítají ze serveru).'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('Opravdu smazat veškerý postup a nastavení v tomto prohlížeči?')) { resetAll(); applyTheme(); closeSettings(); render(); } } }, 'Smazat veškerý postup'),
      h('button', { class: 'btn primary', value: 'close' }, 'Zavřít'),
    ),
  );
  dialog.showModal();
}

const closeSettings = () => dialog.open && dialog.close();
document.getElementById('open-settings').addEventListener('click', openSettings);
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// ---------------------------------------------------------------- shell

const TABS = [
  ['today', 'Dnes', viewToday],
  ['decks', 'Balíčky', viewDecks],
  ['stats', 'Statistiky', viewStats],
];

function render() {
  const nav = document.getElementById('nav');
  const header = document.getElementById('header');
  const studying = !!session;
  nav.hidden = header.hidden = studying;
  if (studying) {
    root.replaceChildren(viewStudy());
    return;
  }
  const view = TABS.find(([id]) => id === tab)[2];
  root.replaceChildren(...[view()].flat().filter(Boolean));
  nav.replaceChildren(
    ...TABS.map(([id, label]) =>
      h('button', { class: id === tab ? 'active' : '', 'aria-current': id === tab ? 'page' : null, onclick: () => { tab = id; render(); window.scrollTo(0, 0); } }, label),
    ),
  );
}

async function init() {
  applyTheme();
  ({ packages, errors: loadErrors } = await loadPackages().catch((err) => ({ packages: [], errors: [`Seznam balíčků se nepodařilo načíst (${err.message}).`] })));
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
