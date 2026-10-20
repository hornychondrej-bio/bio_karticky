// Decides which cards are in the study pool and builds the daily queue.
import { MIN, dayIndex, dayStart } from './time.js';
import { store, doneToday } from './store.js';

const LEARNING_LOOKAHEAD = 20 * MIN;

/** Whether a card takes part in studying given the current part/extra/permanent settings. */
export function inPool(card, settings) {
  const part = settings.parts[`${card.pkg}/${card.part}`];
  if (!part) return false; // part never activated
  if (card.type === 'permanent') return settings.permanent;
  if (!part.active) return false;
  return card.type !== 'extra' || settings.extra;
}

/**
 * Queue order: learning cards due soon, then due reviews (limited by the daily cap),
 * then new cards. New cards from parts activated today may exceed the cap.
 */
export function buildQueue(packages, now = Date.now(), onlyPkg = null) {
  const { settings, progress } = store;
  const today = dayIndex(now);
  const endOfDay = dayStart(today + 1);
  const done = doneToday(now);
  const remaining = Math.max(0, settings.dailyCap - done.size);

  const learning = [];
  const reviews = [];
  const fresh = [];
  for (const pkg of packages) {
    if (onlyPkg && pkg.id !== onlyPkg) continue;
    for (const card of pkg.cards) {
      if (!inPool(card, settings)) continue;
      const p = progress[card.key];
      if (!p || p.st === 0) {
        if (!done.has(card.key)) fresh.push(card);
      } else if (p.st === 2) {
        if (p.due < endOfDay) reviews.push(card);
      } else if (p.due <= now + LEARNING_LOOKAHEAD) learning.push(card);
    }
  }

  learning.sort((a, b) => progress[a.key].due - progress[b.key].due);
  reviews.sort((a, b) => progress[a.key].due - progress[b.key].due);
  const dueReviews = reviews.slice(0, remaining);

  let slots = remaining - dueReviews.length;
  const newCards = [];
  for (const card of fresh) {
    const part = settings.parts[`${card.pkg}/${card.part}`];
    const overflow = part.active && part.activatedDay === today;
    if (overflow || slots > 0) {
      newCards.push(card);
      if (!overflow) slots--;
    }
  }

  return {
    queue: [...learning, ...dueReviews, ...newCards],
    counts: { learning: learning.length, reviews: reviews.length, due: dueReviews.length, fresh: newCards.length },
  };
}
