import { describe, it, expect } from "vitest";
import { checkAchievements, ACHIEVEMENTS } from "./achievements.js";

const noUnlocked = new Set();

describe("checkAchievements", () => {
  it("returns first_item when totalCompleted >= 1", () => {
    const result = checkAchievements({ totalCompleted: 1, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 1 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("first_item");
  });

  it("returns getting_started when totalCompleted >= 5", () => {
    const result = checkAchievements({ totalCompleted: 5, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 1 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("getting_started");
  });

  it("returns on_a_roll when totalCompleted >= 25", () => {
    const result = checkAchievements({ totalCompleted: 25, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 1 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("on_a_roll");
  });

  it("returns first_streak when streakCount >= 3", () => {
    const result = checkAchievements({ totalCompleted: 0, streakCount: 3, sessionDurationMs: null, sessionItemsCompleted: 0 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("first_streak");
  });

  it("returns week_streak when streakCount >= 7", () => {
    const result = checkAchievements({ totalCompleted: 0, streakCount: 7, sessionDurationMs: null, sessionItemsCompleted: 0 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("week_streak");
  });

  it("returns speed_run when session completed in under 5 minutes", () => {
    const result = checkAchievements({ totalCompleted: 1, streakCount: 0, sessionDurationMs: 4 * 60 * 1000, sessionItemsCompleted: 1 }, noUnlocked);
    expect(result.map((a) => a.id)).toContain("speed_run");
  });

  it("does not return speed_run when sessionItemsCompleted is 0", () => {
    const result = checkAchievements({ totalCompleted: 0, streakCount: 0, sessionDurationMs: 1000, sessionItemsCompleted: 0 }, noUnlocked);
    expect(result.map((a) => a.id)).not.toContain("speed_run");
  });

  it("does not return speed_run when duration is null", () => {
    const result = checkAchievements({ totalCompleted: 1, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 1 }, noUnlocked);
    expect(result.map((a) => a.id)).not.toContain("speed_run");
  });

  it("does not return already-unlocked achievements", () => {
    const already = new Set(["first_item", "getting_started"]);
    const result = checkAchievements({ totalCompleted: 25, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 1 }, already);
    const ids = result.map((a) => a.id);
    expect(ids).not.toContain("first_item");
    expect(ids).not.toContain("getting_started");
    expect(ids).toContain("on_a_roll");
  });

  it("returns empty array when no conditions met", () => {
    const result = checkAchievements({ totalCompleted: 0, streakCount: 0, sessionDurationMs: null, sessionItemsCompleted: 0 }, noUnlocked);
    expect(result).toHaveLength(0);
  });
});
