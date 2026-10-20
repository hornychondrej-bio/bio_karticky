// Statistics derived from progress and the review log.
import { DAY, dayIndex } from './time.js';
import { store } from './store.js';

export const MASTERY = [
  { id: 'locked', label: 'Zamčené' },
  { id: 'new', label: 'Nové' },
  { id: 'learning', label: 'Učím se' },
  { id: 'young', label: 'Mladé' },
  { id: 'mature', label: 'Zvládnuté' },
];
// A review card is "mature" once its scheduled interval (as shown on the rating buttons) is at least this long.
export const MATURE_INTERVAL_DAYS = 21;

export function masteryOf(card) {
  if (!store.settings.parts[`${card.pkg}/${card.part}`]) return 'locked';
  const p = store.progress[card.key];
  if (!p || p.st === 0) return 'new';
  if (p.st !== 2) return 'learning';
  return (p.due - p.last) / DAY >= MATURE_INTERVAL_DAYS - 0.5 ? 'mature' : 'young';
}

/** Counts of cards per mastery level for a list of cards. */
export function masteryCounts(cards) {
  const counts = Object.fromEntries(MASTERY.map((m) => [m.id, 0]));
  for (const card of cards) counts[masteryOf(card)]++;
  return counts;
}

function reviewsPerDay() {
  const perDay = new Map();
  for (const [ts] of store.log) {
    const d = dayIndex(ts);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  return perDay;
}

/** Current and longest streak of consecutive study days. The current streak survives until the day ends. */
export function streaks(now = Date.now()) {
  const days = [...reviewsPerDay().keys()].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const today = dayIndex(now);
  const daySet = new Set(days);
  let cursor = daySet.has(today) ? today : today - 1;
  let current = 0;
  while (daySet.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, longest };
}

/** Review counts for the last `n` study days, oldest first. */
export function recentActivity(n = 14, now = Date.now()) {
  const perDay = reviewsPerDay();
  const today = dayIndex(now);
  return Array.from({ length: n }, (_, i) => {
    const day = today - (n - 1 - i);
    return { day, count: perDay.get(day) ?? 0, date: new Date(day * DAY) };
  });
}
