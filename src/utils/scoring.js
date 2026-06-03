/**
 * Default weights for the priority scoring function.
 * These can be overridden via the options page in a future iteration.
 *
 * @typedef {Object} ScoringWeights
 * @property {number} interest   - Weight for the user's interest rating (1–5)
 * @property {number} recency    - Weight for how recently the item was added
 * @property {number} staleness  - Weight for items that have been sitting a long time
 * @property {number} moodMatch  - Bonus when current mood matches the item's mood tag
 */

/** @type {ScoringWeights} */
export const DEFAULT_WEIGHTS = {
  interest: 0.5,
  recency: 0.2,
  staleness: 0.2,
  moodMatch: 0.1,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * How many days until an item reaches maximum staleness boost.
 * Items older than this are treated as equally stale.
 */
const STALENESS_CEILING_DAYS = 30;

/**
 * Computes a normalized priority score in the range [0, 100] for a single item.
 *
 * Each factor is normalized to [0, 1] before weighting so that changing one
 * weight doesn't silently dominate the others. The final score is multiplied
 * by 100 and rounded to an integer so it plays nicely as a knapsack value.
 *
 * Factors:
 *  - interest:   user's 1–5 rating, normalized to [0, 1]
 *  - recency:    items added today score 1.0, decaying linearly to 0 at STALENESS_CEILING_DAYS
 *  - staleness:  inverse of recency — items sitting the longest get the boost
 *  - moodMatch:  1.0 if currentMood matches item.mood, 0 otherwise
 *
 * @param {import('../core/knapsack.js').KnapsackItem & {
 *   interest: number,
 *   addedAt:  number,
 *   mood?:    string,
 * }} item
 * @param {Object}  [opts]
 * @param {string}  [opts.currentMood]  - User's current mood tag (e.g. "focus", "low-energy")
 * @param {number}  [opts.now]          - Current timestamp in ms; defaults to Date.now()
 * @param {ScoringWeights} [opts.weights]
 * @returns {number} Integer score in [0, 100]
 */
export function computeScore(item, opts = {}) {
  const { currentMood = null, now = Date.now(), weights = DEFAULT_WEIGHTS } = opts;

  // Interest: normalize 1–5 → 0–1
  const interestScore = (item.interest - 1) / 4;

  const ageInDays = (now - item.addedAt) / MS_PER_DAY;
  const ageFraction = Math.min(ageInDays / STALENESS_CEILING_DAYS, 1);

  // Recency: new items score high, old items score low
  const recencyScore = 1 - ageFraction;

  // Staleness: inverse — items sitting longest get the boost, capped at 1
  const stalenessScore = ageFraction;

  // Mood: binary bonus
  const moodScore = currentMood && item.mood && currentMood === item.mood ? 1 : 0;

  const raw =
    weights.interest * interestScore +
    weights.recency * recencyScore +
    weights.staleness * stalenessScore +
    weights.moodMatch * moodScore;

  // raw is in [0, 1] when weights sum to 1; clamp defensively in case they don't
  return Math.round(Math.min(Math.max(raw, 0), 1) * 100);
}

/**
 * Scores all items in the list and attaches the result as item.value.
 * Returns a new array — does not mutate the originals.
 *
 * @param {Array}  items
 * @param {Object} [opts]  - Same options as computeScore
 * @returns {Array}        - Items with a `value` field set to their computed score
 */
export function scoreItems(items, opts = {}) {
  return items.map((item) => ({ ...item, value: computeScore(item, opts) }));
}
