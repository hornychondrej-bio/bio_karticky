// Study-day helpers. A "study day" rolls over at 4:00 local time, like Anki.

export const DAY = 86400000;
export const MIN = 60000;
export const ROLLOVER_HOUR = 4;

/** Integer index of the study day containing the timestamp. */
export function dayIndex(ts) {
  const d = new Date(ts - ROLLOVER_HOUR * 3600000);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** Timestamp (ms) at which the given study day starts (04:00 local). */
export function dayStart(idx) {
  const d = new Date(idx * DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), ROLLOVER_HOUR).getTime();
}
