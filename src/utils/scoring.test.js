import { describe, it, expect } from "vitest";
import { computeScore, scoreItems, DEFAULT_WEIGHTS } from "./scoring.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Builds a minimal valid item for scoring
const item = (overrides = {}) => ({
  id: "test",
  weight: 10,
  interest: 3,
  addedAt: Date.now(),
  mood: null,
  ...overrides,
});

// ─── Output range ─────────────────────────────────────────────────────────────

describe("computeScore output range", () => {
  it("returns an integer", () => {
    const score = computeScore(item());
    expect(Number.isInteger(score)).toBe(true);
  });

  it("is always between 0 and 100 inclusive", () => {
    const cases = [
      item({ interest: 1, addedAt: Date.now() }),
      item({ interest: 5, addedAt: Date.now() }),
      item({ interest: 1, addedAt: Date.now() - 60 * MS_PER_DAY }),
      item({ interest: 5, addedAt: Date.now() - 60 * MS_PER_DAY, mood: "focus" }),
    ];
    for (const i of cases) {
      const score = computeScore(i, { currentMood: "focus" });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Interest factor ─────────────────────────────────────────────────────────

describe("interest factor", () => {
  it("higher interest produces a higher score, all else equal", () => {
    const now = Date.now();
    const low = computeScore(item({ interest: 1, addedAt: now }), { now });
    const mid = computeScore(item({ interest: 3, addedAt: now }), { now });
    const high = computeScore(item({ interest: 5, addedAt: now }), { now });
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });
});

// ─── Recency factor ──────────────────────────────────────────────────────────

describe("recency factor", () => {
  it("a brand-new item scores higher than a 29-day-old item when staleness is disabled", () => {
    // With equal recency + staleness weights they cancel each other out at any age.
    // Isolate recency by zeroing out staleness so the factor is visible.
    const now = Date.now();
    const weights = { ...DEFAULT_WEIGHTS, staleness: 0, recency: DEFAULT_WEIGHTS.recency + DEFAULT_WEIGHTS.staleness };
    const fresh = computeScore(item({ interest: 3, addedAt: now }), { now, weights });
    const older = computeScore(item({ interest: 3, addedAt: now - 29 * MS_PER_DAY }), { now, weights });
    expect(fresh).toBeGreaterThan(older);
  });
});

// ─── Staleness factor ────────────────────────────────────────────────────────

describe("staleness factor", () => {
  it("a 30-day-old item scores higher than a 5-day-old item on the staleness axis", () => {
    // Isolate staleness by using equal-weight, equal-interest items and
    // comparing with staleness weight at 1 and others at 0
    const now = Date.now();
    const weights = { interest: 0, recency: 0, staleness: 1, moodMatch: 0 };
    const fresh = computeScore(item({ interest: 3, addedAt: now - 5 * MS_PER_DAY }), {
      now,
      weights,
    });
    const stale = computeScore(item({ interest: 3, addedAt: now - 30 * MS_PER_DAY }), {
      now,
      weights,
    });
    expect(stale).toBeGreaterThan(fresh);
  });

  it("staleness score plateaus after 30 days", () => {
    const now = Date.now();
    const weights = { interest: 0, recency: 0, staleness: 1, moodMatch: 0 };
    const at30 = computeScore(item({ addedAt: now - 30 * MS_PER_DAY }), { now, weights });
    const at60 = computeScore(item({ addedAt: now - 60 * MS_PER_DAY }), { now, weights });
    expect(at30).toBe(at60);
  });
});

// ─── Mood match factor ───────────────────────────────────────────────────────

describe("mood match factor", () => {
  it("matching mood produces a higher score than no mood set", () => {
    const now = Date.now();
    const noMood = computeScore(item({ mood: "focus" }), { now, currentMood: null });
    const matched = computeScore(item({ mood: "focus" }), { now, currentMood: "focus" });
    expect(matched).toBeGreaterThan(noMood);
  });

  it("mismatched mood gives no bonus", () => {
    const now = Date.now();
    const mismatched = computeScore(item({ mood: "focus" }), { now, currentMood: "low-energy" });
    const noMood = computeScore(item({ mood: "focus" }), { now, currentMood: null });
    expect(mismatched).toBe(noMood);
  });

  it("mood match is 0 when item has no mood tag", () => {
    const now = Date.now();
    const withMood = computeScore(item({ mood: null }), { now, currentMood: "focus" });
    const noMood = computeScore(item({ mood: null }), { now, currentMood: null });
    expect(withMood).toBe(noMood);
  });
});

// ─── Custom weights ──────────────────────────────────────────────────────────

describe("custom weights", () => {
  it("interest-only weights: score depends entirely on interest", () => {
    const now = Date.now();
    const weights = { interest: 1, recency: 0, staleness: 0, moodMatch: 0 };
    const low = computeScore(item({ interest: 1, addedAt: now }), { now, weights });
    const high = computeScore(item({ interest: 5, addedAt: now }), { now, weights });
    // interest 1 → normalized 0 → score 0; interest 5 → normalized 1 → score 100
    expect(low).toBe(0);
    expect(high).toBe(100);
  });

  it("zero weights produce a score of 0", () => {
    const weights = { interest: 0, recency: 0, staleness: 0, moodMatch: 0 };
    const score = computeScore(item({ interest: 5 }), { weights, currentMood: "focus" });
    expect(score).toBe(0);
  });

  it("DEFAULT_WEIGHTS factors sum to 1", () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

// ─── scoreItems ──────────────────────────────────────────────────────────────

describe("scoreItems", () => {
  it("attaches a numeric value field to each item", () => {
    const items = [
      item({ id: "a", interest: 2 }),
      item({ id: "b", interest: 4 }),
    ];
    const scored = scoreItems(items);
    for (const s of scored) {
      expect(typeof s.value).toBe("number");
      expect(Number.isInteger(s.value)).toBe(true);
    }
  });

  it("does not mutate the original items", () => {
    const original = item({ interest: 3 });
    const before = { ...original };
    scoreItems([original]);
    expect(original).toEqual(before);
  });

  it("preserves all original fields on each item", () => {
    const original = item({ id: "z", interest: 5, mood: "focus" });
    const [scored] = scoreItems([original]);
    expect(scored.id).toBe("z");
    expect(scored.interest).toBe(5);
    expect(scored.mood).toBe("focus");
  });

  it("higher-interest item gets a higher value score", () => {
    const now = Date.now();
    const items = [
      item({ id: "low", interest: 1, addedAt: now }),
      item({ id: "high", interest: 5, addedAt: now }),
    ];
    const scored = scoreItems(items, { now });
    const low = scored.find((i) => i.id === "low");
    const high = scored.find((i) => i.id === "high");
    expect(high.value).toBeGreaterThan(low.value);
  });

  it("returns an empty array for empty input", () => {
    expect(scoreItems([])).toEqual([]);
  });
});
