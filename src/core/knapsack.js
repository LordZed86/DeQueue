/** Maximum supported time budget in minutes. Caps the DP table width. */
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
 * Solves the 0/1 knapsack problem using bottom-up tabulation.
 *
 * Builds a 2D table dp[i][w] = maximum value achievable using the first i items
 * with a capacity of w minutes, then backtracks to recover which items were selected.
 *
 * @param {number}         budget - Available time in minutes (clamped to MAX_BUDGET_MINUTES)
 * @param {KnapsackItem[]} items  - Candidate items; must have integer weight >= 1
 * @returns {KnapsackResult}
 */
export function knapsack(budget, items) {
  const cap = Math.min(Math.floor(budget), MAX_BUDGET_MINUTES);

  // Filter out items that can never fit (weight 0 or over the hard cap)
  const candidates = items.filter(
    (item) => item.weight >= 1 && item.weight <= cap
  );

  const n = candidates.length;

  if (n === 0 || cap === 0) {
    return { selected: [], totalValue: 0, totalWeight: 0 };
  }

  // Build the DP table: dp[i][w] = best value using candidates[0..i-1] with capacity w
  // Row 0 is the base case (no items) and is already 0-filled.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(cap + 1));

  for (let i = 1; i <= n; i++) {
    const item = candidates[i - 1];
    for (let w = 0; w <= cap; w++) {
      if (item.weight > w) {
        // Can't include this item at capacity w
        dp[i][w] = dp[i - 1][w];
      } else {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - item.weight] + item.value
        );
      }
    }
  }

  // Backtrack from dp[n][cap] to recover the selected set
  const selected = [];
  let w = cap;
  for (let i = n; i >= 1; i--) {
    // If the value changed from row i-1 to row i, item i-1 was included
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(candidates[i - 1]);
      w -= candidates[i - 1].weight;
    }
  }

  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  const totalValue = selected.reduce((sum, item) => sum + item.value, 0);

  return { selected, totalValue, totalWeight };
}

/**
 * Brute-force exhaustive search over all 2^n subsets.
 * Only practical for n <= 15. Used to verify the DP result in tests.
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
  let bestMask = 0;

  for (let mask = 0; mask < 1 << n; mask++) {
    let totalWeight = 0;
    let totalValue = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        totalWeight += candidates[i].weight;
        totalValue += candidates[i].value;
      }
    }
    if (totalWeight <= cap && totalValue > bestValue) {
      bestValue = totalValue;
      bestMask = mask;
    }
  }

  const selected = candidates.filter((_, i) => bestMask & (1 << i));
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);

  return { selected, totalValue: bestValue, totalWeight };
}
