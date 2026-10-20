// FSRS-5 scheduler (default parameters, no optimizer, no fuzz).
// Grades: 1 = Znovu (Again), 2 = Obtížné (Hard), 3 = Dobré (Good), 4 = Jednoduché (Easy).
// Card states: 0 = new, 1 = learning, 2 = review, 3 = relearning.

import { DAY, MIN, dayIndex, dayStart } from './time.js';

const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const RETENTION = 0.9;
const MAX_DAYS = 36500;
const LEARN_STEPS = [1, 10]; // minutes
const RELEARN_STEPS = [10]; // minutes

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round4 = (x) => Math.round(x * 10000) / 10000;

export const retrievability = (elapsedDays, s) => Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
const intervalDays = (s) => (s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1);

const initStability = (g) => Math.max(W[g - 1], 0.1);
const initDifficulty = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);

function nextDifficulty(d, g) {
  const next = d + (-W[6] * (g - 3) * (10 - d)) / 9;
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * next, 1, 10);
}

function recallStability(d, s, r, g) {
  const hardPenalty = g === 2 ? W[15] : 1;
  const easyBonus = g === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus)
  );
}

function forgetStability(d, s, r) {
  const next = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return Math.min(next, s / Math.exp(W[17] * W[18]));
}

/** Outcomes of grading a review card; intervals are forced to be Hard < Good < Easy. */
function reviewOutcomes(c, now) {
  const r = retrievability(Math.max(0, (now - c.last) / DAY), c.s);
  const out = {};
  for (const g of [2, 3, 4]) {
    const s = recallStability(c.d, c.s, r, g);
    out[g] = { s, d: nextDifficulty(c.d, g), days: clamp(Math.round(intervalDays(s)), 1, MAX_DAYS) };
  }
  out[2].days = Math.min(out[2].days, out[3].days);
  out[3].days = Math.max(out[3].days, out[2].days + 1);
  out[4].days = Math.max(out[4].days, out[3].days + 1);
  out[1] = { s: forgetStability(c.d, c.s, r), d: nextDifficulty(c.d, 1) };
  return out;
}

function graduate(c, now) {
  c.st = 2;
  c.step = 0;
  const days = clamp(Math.round(intervalDays(c.s)), 1, MAX_DAYS);
  c.due = dayStart(dayIndex(now) + days);
}

function applyStep(c, g, now, steps) {
  if (g === 4) return graduate(c, now);
  if (g === 1) c.step = 0;
  else if (g === 3) {
    if (c.step + 1 >= steps.length) return graduate(c, now);
    c.step++;
  }
  c.due = now + steps[c.step] * MIN;
}

/** Returns the new card state after grading; `prev` may be undefined for a new card. */
export function schedule(prev, g, now) {
  const c = prev
    ? { ...prev }
    : { st: 0, s: 0, d: 0, due: now, last: 0, step: 0, reps: 0, lapses: 0 };
  c.reps++;

  if (c.st === 0) {
    c.s = initStability(g);
    c.d = initDifficulty(g);
    c.st = 1;
    c.step = 0;
    applyStep(c, g, now, LEARN_STEPS);
  } else if (c.st === 1) {
    applyStep(c, g, now, LEARN_STEPS);
  } else if (c.st === 3) {
    applyStep(c, g, now, RELEARN_STEPS);
  } else {
    const o = reviewOutcomes(c, now);
    c.s = o[g].s;
    c.d = o[g].d;
    if (g === 1) {
      c.lapses++;
      c.st = 3;
      c.step = 0;
      c.due = now + RELEARN_STEPS[0] * MIN;
    } else {
      c.due = dayStart(dayIndex(now) + o[g].days);
    }
  }
  c.s = round4(c.s);
  c.d = round4(c.d);
  c.last = now;
  return c;
}

function label(next, now) {
  if (next.st === 2) {
    const days = dayIndex(next.due) - dayIndex(now);
    if (days < 30) return `${days} d`;
    if (days < 365) return `${Math.round(days / 30)} měs.`;
    return `${Math.round((days / 365) * 10) / 10} r.`;
  }
  return `${Math.max(1, Math.round((next.due - now) / MIN))} min`;
}

/** Interval labels for grades 1..4, shown on the rating buttons. */
export function previewLabels(prev, now) {
  return [1, 2, 3, 4].map((g) => label(schedule(prev, g, now), now));
}
