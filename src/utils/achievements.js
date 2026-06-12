/**
 * Achievement definitions and unlock logic.
 *
 * Each achievement has:
 *   id        — stable key stored in localStorage
 *   name      — display name
 *   desc      — short description shown in the achievements panel
 *   emoji     — icon shown in toast and panel
 *   check(stats) — pure function; returns true when the achievement should unlock
 *
 * stats shape: { totalCompleted, streakCount, sessionDurationMs, sessionItemsCompleted }
 */

export const ACHIEVEMENTS = [
  {
    id: "first_item",
    name: "First Step",
    desc: "Complete your first item",
    emoji: "🌱",
    check: ({ totalCompleted }) => totalCompleted >= 1,
  },
  {
    id: "getting_started",
    name: "Getting Started",
    desc: "Complete 5 items",
    emoji: "📚",
    check: ({ totalCompleted }) => totalCompleted >= 5,
  },
  {
    id: "on_a_roll",
    name: "On a Roll",
    desc: "Complete 25 items",
    emoji: "🚀",
    check: ({ totalCompleted }) => totalCompleted >= 25,
  },
  {
    id: "first_streak",
    name: "Streak Started",
    desc: "Reach a 3-day streak",
    emoji: "🔥",
    check: ({ streakCount }) => streakCount >= 3,
  },
  {
    id: "week_streak",
    name: "Week Warrior",
    desc: "Reach a 7-day streak",
    emoji: "🏆",
    check: ({ streakCount }) => streakCount >= 7,
  },
  {
    id: "speed_run",
    name: "Speed Run",
    desc: "Complete a session in under 5 minutes",
    emoji: "⚡",
    check: ({ sessionDurationMs, sessionItemsCompleted }) =>
      sessionItemsCompleted >= 1 && sessionDurationMs !== null && sessionDurationMs < 5 * 60 * 1000,
  },
];

/**
 * Returns achievements that are newly unlocked given current stats.
 * Filters out any already in the unlockedIds set.
 *
 * @param {Object} stats
 * @param {Set<string>} unlockedIds - IDs already unlocked
 * @returns {typeof ACHIEVEMENTS}
 */
export function checkAchievements(stats, unlockedIds) {
  return ACHIEVEMENTS.filter(
    (a) => !unlockedIds.has(a.id) && a.check(stats)
  );
}
