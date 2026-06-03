import { describe, it, expect } from "vitest";
import { knapsack, knapsackBruteForce, MAX_BUDGET_MINUTES } from "./knapsack.js";

// Helper: build a minimal item for knapsack input
const item = (id, weight, value) => ({ id, weight, value });

// ─── DP vs brute-force agreement ────────────────────────────────────────────

describe("knapsack DP matches brute-force on small inputs", () => {
  it("agrees on a simple 3-item case", () => {
    const items = [item("a", 10, 60), item("b", 20, 100), item("c", 30, 120)];
    const dp = knapsack(50, items);
    const bf = knapsackBruteForce(50, items);
    expect(dp.totalValue).toBe(bf.totalValue);
    expect(dp.totalWeight).toBeLessThanOrEqual(50);
  });

  it("agrees on a 6-item case with a tight budget", () => {
    const items = [
      item("a", 5, 10),
      item("b", 4, 40),
      item("c", 6, 30),
      item("d", 3, 50),
      item("e", 2, 35),
      item("f", 7, 15),
    ];
    const dp = knapsack(10, items);
    const bf = knapsackBruteForce(10, items);
    expect(dp.totalValue).toBe(bf.totalValue);
    expect(dp.totalWeight).toBeLessThanOrEqual(10);
  });

  it("agrees when all items are identical", () => {
    const items = Array.from({ length: 8 }, (_, i) => item(`x${i}`, 5, 20));
    const dp = knapsack(25, items);
    const bf = knapsackBruteForce(25, items);
    expect(dp.totalValue).toBe(bf.totalValue);
  });

  it("agrees when multiple items have the same weight", () => {
    const items = [item("a", 10, 5), item("b", 10, 50), item("c", 10, 30)];
    const dp = knapsack(20, items);
    const bf = knapsackBruteForce(20, items);
    expect(dp.totalValue).toBe(bf.totalValue);
    expect(dp.totalWeight).toBeLessThanOrEqual(20);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("knapsack edge cases", () => {
  it("returns empty selection for an empty item list", () => {
    const result = knapsack(30, []);
    expect(result.selected).toHaveLength(0);
    expect(result.totalValue).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it("returns empty selection when budget is 0", () => {
    const items = [item("a", 5, 10)];
    const result = knapsack(0, items);
    expect(result.selected).toHaveLength(0);
    expect(result.totalValue).toBe(0);
  });

  it("returns empty selection when every item exceeds the budget", () => {
    const items = [item("a", 45, 100), item("b", 50, 200)];
    const result = knapsack(30, items);
    expect(result.selected).toHaveLength(0);
    expect(result.totalValue).toBe(0);
  });

  it("selects the single item when it exactly fits", () => {
    const items = [item("a", 30, 99)];
    const result = knapsack(30, items);
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].id).toBe("a");
    expect(result.totalWeight).toBe(30);
  });

  it("does not select the single item when it is one minute over", () => {
    const items = [item("a", 31, 99)];
    const result = knapsack(30, items);
    expect(result.selected).toHaveLength(0);
  });

  it("filters out items with weight 0", () => {
    const items = [item("zero", 0, 999), item("valid", 5, 10)];
    const result = knapsack(10, items);
    expect(result.selected.every((i) => i.id !== "zero")).toBe(true);
  });

  it("respects MAX_BUDGET_MINUTES cap when budget exceeds it", () => {
    // Items that would only fit if the budget were truly 999
    const items = [item("a", MAX_BUDGET_MINUTES + 1, 100)];
    const result = knapsack(999, items);
    expect(result.selected).toHaveLength(0);
  });
});

// ─── Correctness: known optimal solutions ────────────────────────────────────

describe("knapsack produces correct optimal selections", () => {
  it("picks the two items that maximize value, not the two lightest", () => {
    // budget 10 min
    // a=4min/10pts, b=5min/50pts, c=6min/55pts
    // optimal: a+c = 10min / 65pts (not b+a=60pts, not c alone=55pts)
    const items = [item("a", 4, 10), item("b", 5, 50), item("c", 6, 55)];
    const result = knapsack(10, items);
    expect(result.totalValue).toBe(65);
    expect(result.totalWeight).toBe(10);
  });

  it("fills capacity exactly when a perfect fit exists", () => {
    const items = [item("a", 15, 10), item("b", 25, 40), item("c", 20, 30)];
    // budget 45: optimal is b+c = 45min / 70pts
    const result = knapsack(45, items);
    expect(result.totalValue).toBe(70);
    expect(result.totalWeight).toBe(45);
  });

  it("totalWeight never exceeds the requested budget", () => {
    const items = [
      item("a", 7, 45),
      item("b", 13, 80),
      item("c", 17, 95),
      item("d", 22, 130),
      item("e", 3, 20),
    ];
    for (const budget of [10, 20, 30, 40, 50, 60]) {
      const result = knapsack(budget, items);
      expect(result.totalWeight).toBeLessThanOrEqual(budget);
    }
  });

  it("selected item ids are a subset of the input ids", () => {
    const items = [item("x", 8, 30), item("y", 12, 55), item("z", 20, 90)];
    const inputIds = new Set(items.map((i) => i.id));
    const result = knapsack(30, items);
    for (const selected of result.selected) {
      expect(inputIds.has(selected.id)).toBe(true);
    }
  });
});

// ─── brute-force sanity checks ───────────────────────────────────────────────

describe("knapsackBruteForce", () => {
  it("handles empty input", () => {
    const result = knapsackBruteForce(30, []);
    expect(result.selected).toHaveLength(0);
    expect(result.totalValue).toBe(0);
  });

  it("picks the highest-value item that fits", () => {
    const items = [item("cheap", 5, 10), item("expensive", 5, 99)];
    const result = knapsackBruteForce(5, items);
    expect(result.totalValue).toBe(99);
    expect(result.selected[0].id).toBe("expensive");
  });
});
