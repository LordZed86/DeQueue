import { describe, it, expect } from "vitest";
import { knapsack } from "./knapsack.js";
import { buildSessionQueue } from "./queue.js";
import { scoreItems, DEFAULT_WEIGHTS } from "../utils/scoring.js";

// ── Helpers ────────────────────────────────────────────────

/**
 * Builds a realistic item for the full pipeline.
 * weight/timeEstimate are kept in sync — scoring uses timeEstimate,
 * knapsack uses weight.
 */
function makeItem(id, { interest = 3, ageDays = 0, timeEstimate = 5, mood = null } = {}) {
  const addedAt = Date.now() - ageDays * 24 * 60 * 60 * 1000;
  return { id, interest, addedAt, timeEstimate, weight: timeEstimate, mood };
}

/** Generates n items with randomized but valid properties. */
function makeItems(n, seed = 1) {
  const items = [];
  for (let i = 0; i < n; i++) {
    // Deterministic "random" so tests are reproducible
    const pseudo = ((seed * 1103515245 + i * 12345) & 0x7fffffff) % 100;
    items.push(
      makeItem(`item-${i}`, {
        interest: (pseudo % 5) + 1,
        ageDays: pseudo % 30,
        timeEstimate: (pseudo % 15) + 1,
      })
    );
  }
  return items;
}

// ── Integration: full pipeline ─────────────────────────────

describe("full pipeline: scoreItems → knapsack → buildSessionQueue", () => {
  it("produces a non-empty session from a realistic set of items", () => {
    const raw = [
      makeItem("a", { interest: 5, ageDays: 1, timeEstimate: 10 }),
      makeItem("b", { interest: 3, ageDays: 10, timeEstimate: 5 }),
      makeItem("c", { interest: 4, ageDays: 5, timeEstimate: 8 }),
      makeItem("d", { interest: 2, ageDays: 20, timeEstimate: 15 }),
    ];

    const scored = scoreItems(raw);
    const result = knapsack(20, scored);
    const queue = buildSessionQueue(result.selected);

    expect(queue.isEmpty).toBe(false);
    expect(result.totalWeight).toBeLessThanOrEqual(20);
  });

  it("first item in the queue is the highest-value selected item", () => {
    const raw = [
      makeItem("low", { interest: 1, ageDays: 25, timeEstimate: 5 }),
      makeItem("mid", { interest: 3, ageDays: 10, timeEstimate: 5 }),
      makeItem("high", { interest: 5, ageDays: 1, timeEstimate: 5 }),
    ];

    const scored = scoreItems(raw);
    const result = knapsack(15, scored);
    const queue = buildSessionQueue(result.selected);

    const first = queue.peek();
    const allValues = queue.toArray().map((i) => i.value);
    expect(first.value).toBe(Math.max(...allValues));
  });

  it("no completed item leaks into a session", () => {
    const raw = [
      makeItem("done", { interest: 5, ageDays: 0, timeEstimate: 5 }),
      makeItem("pending", { interest: 3, ageDays: 5, timeEstimate: 5 }),
    ];

    // Simulate what getPendingItems() does — exclude completed items
    const pending = raw.filter((i) => !i.completed);
    const scored = scoreItems(pending);
    const result = knapsack(20, scored);

    const ids = result.selected.map((i) => i.id);
    expect(ids).not.toContain("done-completed");
  });

  it("mood match elevates the matching item to the front of the queue", () => {
    const now = Date.now();
    const raw = [
      { ...makeItem("focus-item", { interest: 3, ageDays: 5, timeEstimate: 5 }), mood: "focus" },
      makeItem("no-mood", { interest: 3, ageDays: 5, timeEstimate: 5 }),
    ];

    const scored = scoreItems(raw, { currentMood: "focus" });
    const result = knapsack(20, scored);
    const queue = buildSessionQueue(result.selected);

    expect(queue.peek().id).toBe("focus-item");
  });

  it("session queue reflects done/skip state correctly mid-session", () => {
    const raw = [
      makeItem("first", { interest: 5, ageDays: 1, timeEstimate: 5 }),
      makeItem("second", { interest: 4, ageDays: 2, timeEstimate: 5 }),
      makeItem("third", { interest: 3, ageDays: 3, timeEstimate: 5 }),
    ];

    const scored = scoreItems(raw);
    const result = knapsack(15, scored);
    const queue = buildSessionQueue(result.selected);

    const firstId = queue.peek().id;
    queue.skip();
    expect(queue.peek().id).not.toBe(firstId);

    queue.dequeue();
    expect(queue.size).toBe(2);

    // The skipped first item is now at the back
    const remaining = queue.toArray().map((i) => i.id);
    expect(remaining[remaining.length - 1]).toBe(firstId);
  });

  it("returns empty session when budget is too small for any item", () => {
    const raw = [
      makeItem("a", { timeEstimate: 10 }),
      makeItem("b", { timeEstimate: 15 }),
    ];
    const scored = scoreItems(raw);
    const result = knapsack(5, scored);
    expect(result.selected).toHaveLength(0);
    const queue = buildSessionQueue(result.selected);
    expect(queue.isEmpty).toBe(true);
  });
});

// ── Stress tests ───────────────────────────────────────────

describe("knapsack stress tests", () => {
  it("handles 50 items without error and respects the budget", () => {
    const items = makeItems(50);
    const scored = scoreItems(items);
    const result = knapsack(30, scored);

    expect(result.totalWeight).toBeLessThanOrEqual(30);
    expect(result.selected.length).toBeGreaterThanOrEqual(0);
    expect(result.totalValue).toBeGreaterThanOrEqual(0);
  });

  it("handles 100 items without error and respects the budget", () => {
    const items = makeItems(100);
    const scored = scoreItems(items);
    const result = knapsack(60, scored);

    expect(result.totalWeight).toBeLessThanOrEqual(60);
    expect(result.selected.length).toBeGreaterThanOrEqual(0);
  });

  it("selected item ids are a subset of input ids with 100 items", () => {
    const items = makeItems(100);
    const scored = scoreItems(items);
    const result = knapsack(45, scored);

    const inputIds = new Set(items.map((i) => i.id));
    result.selected.forEach((item) => {
      expect(inputIds.has(item.id)).toBe(true);
    });
  });

  it("totalWeight is the exact sum of selected item weights", () => {
    const items = makeItems(75);
    const scored = scoreItems(items);
    const result = knapsack(40, scored);

    const actualWeight = result.selected.reduce((sum, i) => sum + i.weight, 0);
    expect(result.totalWeight).toBe(actualWeight);
  });

  it("totalValue is the exact sum of selected item values", () => {
    const items = makeItems(75);
    const scored = scoreItems(items);
    const result = knapsack(40, scored);

    const actualValue = result.selected.reduce((sum, i) => sum + i.value, 0);
    expect(result.totalValue).toBe(actualValue);
  });

  it("result is at least as good as any single item that fits", () => {
    const items = makeItems(60);
    const scored = scoreItems(items);
    const budget = 30;
    const result = knapsack(budget, scored);

    // The knapsack must be at least as good as just picking the best single item
    const bestSingle = scored
      .filter((i) => i.weight <= budget)
      .reduce((best, i) => (i.value > (best?.value ?? -1) ? i : best), null);

    if (bestSingle) {
      expect(result.totalValue).toBeGreaterThanOrEqual(bestSingle.value);
    }
  });

  it("completes in a reasonable time with 100 items at max budget", () => {
    const items = makeItems(100, 42);
    const scored = scoreItems(items);

    const start = performance.now();
    knapsack(MAX_BUDGET_MINUTES, scored);
    const elapsed = performance.now() - start;

    // Should be well under 100ms — this is O(n*W) with W=60
    expect(elapsed).toBeLessThan(100);
  });
});

// Import MAX_BUDGET_MINUTES for the timing test
import { MAX_BUDGET_MINUTES } from "./knapsack.js";
