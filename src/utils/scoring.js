/**
 * Default weights for the priority scoring function.
 * These can be overridden via the options page in a future iteration.
 *
 * @typedef {Object} ScoringWeights
 * @property {number} interest   - Weight for the user's interest rating (1–3)
 * @property {number} recency    - Weight for how recently the item was added
 * @property {number} staleness  - Weight for items that have been sitting a long time
 * @property {number} moodMatch  - Weight for how well an item fits the current session mood
 */

/**
 * Recency and staleness are opposing forces (new-first vs. old-first); equal
 * weights cancel out completely regardless of magnitude, leaving age with no
 * effect on score at all. Staleness is weighted higher by default so old,
 * forgotten items get surfaced instead of perpetually losing to new saves —
 * that's the core failure mode DeQueue is designed against.
 * @type {ScoringWeights}
 */
export const DEFAULT_WEIGHTS = {
  interest: 0.5,
  recency: 0.1,
  staleness: 0.3,
  moodMatch: 0.1,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * How many days until an item reaches maximum staleness boost.
 * Items older than this are treated as equally stale.
 */
const STALENESS_CEILING_DAYS = 30;

/**
 * Mood presets bias the session by re-ranking items using signals every item
 * already has (timeEstimate, interest) rather than a per-item mood tag set at
 * save time. Asking the user to predict their future mood when saving an item
 * — days or weeks before a session — was a speculative, easy-to-get-wrong
 * decision that worked against the app's whole anti-paralysis premise. Moods
 * only apply as a session-time filter/bias now; items no longer carry a mood.
 */
const MOOD_BIAS = {
  "low-energy": "short",
  fun: "short",
  focus: "interest",
  curious: "interest",
};

const MAX_BUDGET_MINUTES = 60;

/**
 * Computes a normalized priority score in the range [0, 100] for a single item.
 *
 * Each factor is normalized to [0, 1] before weighting so that changing one
 * weight doesn't silently dominate the others. The final score is multiplied
 * by 100 and rounded to an integer so it plays nicely as a knapsack value.
 *
 * Factors:
 *  - interest:   user's 1–3 rating (defaults to 2/neutral if unset), normalized to [0, 1]
 *  - recency:    items added today score 1.0, decaying linearly to 0 at STALENESS_CEILING_DAYS
 *  - staleness:  inverse of recency — items sitting the longest get the boost
 *  - moodMatch:  session-mood bias — "short" moods favor low timeEstimate, "interest"
 *                moods favor high interest; no mood selected is neutral (0.5) for all items
 *
 * @param {import('../core/knapsack.js').KnapsackItem & {
 *   interest: number,
 *   addedAt:  number,
 * }} item
 * @param {Object}  [opts]
 * @param {string}  [opts.currentMood]  - User's current session mood (e.g. "focus", "low-energy")
 * @param {number}  [opts.now]          - Current timestamp in ms; defaults to Date.now()
 * @param {ScoringWeights} [opts.weights]
 * @returns {number} Integer score in [0, 100]
 */
export function computeScore(item, opts = {}) {
  const { currentMood = null, now = Date.now(), weights = DEFAULT_WEIGHTS } = opts;

  // Interest: normalize 1–3 → 0–1. Unset/out-of-range values fall back to
  // the neutral default (2) rather than skewing the score in either direction.
  const interestRaw = Math.min(Math.max(item.interest ?? 2, 1), 3);
  const interestScore = (interestRaw - 1) / 2;

  const ageInDays = (now - item.addedAt) / MS_PER_DAY;
  const ageFraction = Math.min(ageInDays / STALENESS_CEILING_DAYS, 1);

  // Recency: new items score high, old items score low
  const recencyScore = 1 - ageFraction;

  // Staleness: inverse — items sitting longest get the boost, capped at 1
  const stalenessScore = ageFraction;

  // Mood: no mood selected → neutral, doesn't favor or penalize any item.
  const moodBias = MOOD_BIAS[currentMood] ?? null;
  let moodScore = 0.5;
  if (moodBias === "short") {
    moodScore = 1 - Math.min(item.timeEstimate / MAX_BUDGET_MINUTES, 1);
  } else if (moodBias === "interest") {
    moodScore = interestScore;
  }

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
  return items.map((item) => ({
    ...item,
    weight: item.timeEstimate,
    value: computeScore(item, opts),
  }));
}
