/**
 * Maximum supported time budget in minutes. Caps the DP table width.
 *
 * Keeping this bounded prevents the DP table from growing arbitrarily large.
 * At 60 columns × ~50 typical items, the table stays well under 100 KB.
 */
export const MAX_BUDGET_MINUTES = 60;

/**
 * @typedef {Object} KnapsackItem
 * @property {string} id
 * @property {number} weight - Time estimate in whole minutes
 * @property {number} value  - Priority score from scoring.js
 */

/**
 * @typedef {Object} KnapsackResult
 * @property {KnapsackItem[]} selected - Items chosen by the algorithm
 * @property {number}         totalValue  - Sum of selected item values
 * @property {number}         totalWeight - Sum of selected item weights (minutes used)
 */

/**
 * Solves the 0/1 knapsack problem using bottom-up tabulation (dynamic programming).
 *
 * PROBLEM STATEMENT
 * -----------------
 * Given a time budget (the "knapsack capacity") and a list of tasks (the "items"),
 * each with a weight (minutes) and a value (priority score), find the subset of
 * tasks that maximises total priority without exceeding the budget.
 *
 * WHY "0/1"?
 * ----------
 * Each item is either fully included (1) or fully excluded (0) — you can't do
 * half a task. This is what makes the problem hard: greedy approaches like
 * "always pick the highest value-per-minute task" can miss the optimal solution.
 *
 * ALGORITHM — BOTTOM-UP TABULATION
 * ----------------------------------
 * We build a 2D table:
 *
 *   dp[i][w] = the maximum value achievable using only the first i items
 *              with a capacity of exactly w minutes available.
 *
 * The table has (n+1) rows and (cap+1) columns.
 * Row 0 represents the base case: zero items → value is always 0.
 *
 * For each subsequent item i (1-indexed), and each possible capacity w:
 *   - If item i is too heavy to include at capacity w, we copy the best result
 *     from the row above (don't include item i).
 *   - Otherwise, we take the better of:
 *       a) NOT including item i: dp[i-1][w]
 *       b) INCLUDING item i:     dp[i-1][w - item.weight] + item.value
 *          (use the best value achievable with the remaining capacity, then add
 *          this item's value on top)
 *
 * After filling the table, dp[n][cap] holds the maximum possible value.
 * We then backtrack through the table to find which specific items were chosen.
 *
 * TIME COMPLEXITY:  O(n × cap)  — fills every cell of the DP table once
 * SPACE COMPLEXITY: O(n × cap)  — stores the full table for backtracking
 *
 * @param {number}         budget - Available time in minutes (clamped to MAX_BUDGET_MINUTES)
 * @param {KnapsackItem[]} items  - Candidate items; must have integer weight >= 1
 * @returns {KnapsackResult}
 */
export function knapsack(budget, items) {
  // Budget = whole number no larger than the hard cap.
  // Use Math.floor to ensure fractional minutes are discarded.
  const cap = Math.min(Math.floor(budget), MAX_BUDGET_MINUTES);

  // Filter Items that will never fit:
  // weight 0 is invalid (every task takes at least 1 minute)
  // anything heavier than our full cap can never be chosen.
  const candidates = items.filter(
    (item) => item.weight >= 1 && item.weight <= cap
  );

  const n = candidates.length;

  // Nothing to do if there are no valid items or no time available.
  if (n === 0 || cap === 0) {
    return { selected: [], totalValue: 0, totalWeight: 0 };
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Build the DP table
  //
  // dp is an (n+1) × (cap+1) matrix.
  // Using Int32Array for each row gives us fast, cache-friendly integer storage
  // and automatic zero-initialisation — so dp[0][*] = 0 (the base case) is free.
  // ---------------------------------------------------------------------------
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(cap + 1));

  for (let i = 1; i <= n; i++) {
    // candidates is 0-indexed; row i of dp corresponds to candidates[i-1]
    const item = candidates[i - 1];

    for (let w = 0; w <= cap; w++) {
      if (item.weight > w) {
        // This item is too heavy for the current capacity w.
        // Best we can do is the same as without this item: copy from row above.
        dp[i][w] = dp[i - 1][w];
      } else {
        // Choose whichever is larger:
        //   - Skip item i and keep the previous best at capacity w
        //   - Include item i: best value with the leftover capacity, plus item's value
        dp[i][w] = Math.max(
          dp[i - 1][w], // exclude item i
          dp[i - 1][w - item.weight] + item.value // include item i
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Backtrack to recover the selected items
  //
  // We start at dp[n][cap] — the optimal solution cell — and walk backward
  // through the rows. At each row i, if the value is different from dp[i-1][w],
  // item i must have been included (otherwise the values would match).
  // When we include an item, we reduce the remaining capacity by its weight.
  // ---------------------------------------------------------------------------
  const selected = [];
  let w = cap; // tracks remaining capacity as we backtrack

  for (let i = n; i >= 1; i--) {
    // If the value at this row differs from the row above, item i-1 was chosen.
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(candidates[i - 1]);
      // "Undo" this item's weight to find the remaining capacity in the prior row
      w -= candidates[i - 1].weight;
    }
    // If values are equal, item i-1 was NOT chosen; just move up a row.
  }

  // Compute totals from the selected set (selected may be in reverse order, but
  // reduce doesn't care about order).
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  const totalValue = selected.reduce((sum, item) => sum + item.value, 0);

  return { selected, totalValue, totalWeight };
}

/**
 * Brute-force exhaustive search over all 2^n subsets.
 *
 * HOW IT WORKS
 * ------------
 * With n items there are 2^n possible subsets (each item is either in or out).
 * We enumerate every subset using a bitmask: an integer `mask` from 0 to 2^n - 1.
 * Bit i of `mask` being set (1) means candidates[i] is included in that subset.
 *
 * For each mask we compute the total weight and value of that subset and keep
 * track of the best (highest value) subset that fits within the budget.
 *
 * WHY THIS EXISTS
 * ---------------
 * Brute force is exponential — O(n × 2^n) — so it's unusable for large inputs.
 * But it is trivially correct, making it ideal as a test oracle: if the DP
 * result ever disagrees with brute force on a small input, the DP has a bug.
 *
 * PRACTICAL LIMIT: Only safe for n ≤ ~20; beyond that, 2^n subsets become
 * too slow to enumerate. Our tests keep n ≤ 15.
 *
 * @param {number}         budget
 * @param {KnapsackItem[]} items
 * @returns {KnapsackResult}
 */
export function knapsackBruteForce(budget, items) {
  const cap = Math.min(Math.floor(budget), MAX_BUDGET_MINUTES);
  const candidates = items.filter(
    (item) => item.weight >= 1 && item.weight <= cap
  );
  const n = candidates.length;

  let bestValue = 0;
  let bestMask = 0; // bitmask representing the best subset found so far

  // Iterate over every possible subset. `1 << n` equals 2^n.
  // mask = 0b000 means no items selected; mask = 0b111 (for n=3) means all selected.
  for (let mask = 0; mask < 1 << n; mask++) {
    let totalWeight = 0;
    let totalValue = 0;

    // Check each item: if bit i is set in mask, item i is part of this subset.
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        // bitwise AND isolates bit i
        totalWeight += candidates[i].weight;
        totalValue += candidates[i].value;
      }
    }

    // Only consider this subset if it fits within the budget AND beats the current best.
    if (totalWeight <= cap && totalValue > bestValue) {
      bestValue = totalValue;
      bestMask = mask; // remember which subset gave this value
    }
  }

  // Recover the selected items from the winning bitmask.
  const selected = candidates.filter((_, i) => bestMask & (1 << i));
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);

  return { selected, totalValue: bestValue, totalWeight };
}
