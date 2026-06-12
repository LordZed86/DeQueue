/**
 * Thin wrapper around localStorage for DeQueue data.
 *
 * Two keys are used:
 *   KEYS.ITEMS    → JSON array of Item objects
 *   KEYS.SETTINGS → JSON object of user preferences
 *
 * All other modules read and write through these functions — nothing else
 * touches localStorage directly. This makes a future migration to IndexedDB
 * a single-file change.
 */

export const KEYS = {
  ITEMS: "dequeue_items",
  SETTINGS: "dequeue_settings",
  STREAK: "dequeue_streak",
};

/** @typedef {import('../core/knapsack.js').KnapsackItem & import('./scoring.js').ScoringInput} Item */

// ─── Items ────────────────────────────────────────────────────────────────────

/**
 * Returns all saved items. Never throws — returns [] on missing or corrupt data.
 * @returns {Item[]}
 */
export function getItems() {
  try {
    const raw = localStorage.getItem(KEYS.ITEMS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Overwrites the entire items list. Use saveItem / deleteItem for single-item ops.
 * @param {Item[]} items
 */
function setItems(items) {
  localStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
}

/**
 * Appends a new item to storage. Caller is responsible for supplying a unique id.
 * @param {Item} item
 */
export function saveItem(item) {
  const items = getItems();
  items.push(item);
  setItems(items);
}

/**
 * Replaces one item in storage by id. No-ops silently if the id is not found.
 * @param {Item} updatedItem
 */
export function updateItem(updatedItem) {
  const items = getItems();
  const idx = items.findIndex((i) => i.id === updatedItem.id);
  if (idx === -1) return;
  items[idx] = updatedItem;
  setItems(items);
}

/**
 * Removes one item from storage by id. No-ops silently if the id is not found.
 * @param {string} id
 */
export function deleteItem(id) {
  const items = getItems().filter((i) => i.id !== id);
  setItems(items);
}

/**
 * Marks an item as completed and records the completion timestamp.
 * @param {string} id
 * @param {number} [completedAt] - Defaults to Date.now()
 */
export function markCompleted(id, completedAt = Date.now()) {
  const items = getItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], completed: true, completedAt };
  setItems(items);
}

/**
 * Returns only the items that have not yet been completed.
 * This is what gets passed to the knapsack — completed items are excluded.
 * @returns {Item[]}
 */
export function getPendingItems() {
  return getItems().filter((i) => !i.completed);
}

/**
 * Marks an item as in-progress (session was interrupted on this item).
 * Clears the flag on all other items first so at most one is flagged.
 * @param {string} id
 */
export function markInProgress(id) {
  const items = getItems().map((i) => ({
    ...i,
    inProgress: i.id === id ? true : false,
  }));
  localStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
}

/**
 * Clears the in-progress flag on all items.
 */
export function clearInProgress() {
  const items = getItems().map((i) => ({ ...i, inProgress: false }));
  localStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Settings
 * @property {number} defaultBudget   - Default time budget shown in the popup (minutes)
 * @property {string} [defaultMood]   - Pre-selected mood tag, if any
 * @property {import('./scoring.js').ScoringWeights} [weights] - Custom scoring weights
 */

/** @type {Settings} */
const DEFAULT_SETTINGS = {
  defaultBudget: 20,
  defaultMood: null,
  weights: null, // null means use DEFAULT_WEIGHTS from scoring.js
};

/**
 * Returns saved settings merged with defaults. Never throws.
 * @returns {Settings}
 */
export function getSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves settings. Merges with existing saved settings so callers can update
 * one field without overwriting everything else.
 * @param {Partial<Settings>} patch
 */
export function saveSettings(patch) {
  const current = getSettings();
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...patch }));
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} StreakData
 * @property {number} count            - Current consecutive-day streak
 * @property {string|null} lastDate    - ISO date string "YYYY-MM-DD" of last completion
 */

/** @returns {StreakData} */
export function getStreak() {
  try {
    const raw = localStorage.getItem(KEYS.STREAK);
    return raw ? JSON.parse(raw) : { count: 0, lastDate: null };
  } catch {
    return { count: 0, lastDate: null };
  }
}

/**
 * Call once per completed item. Increments the streak if today is the first
 * completion of the day, resets to 1 if a day was missed.
 * @param {string} [todayStr] - "YYYY-MM-DD", defaults to today. Override in tests.
 * @returns {StreakData} updated streak
 */
export function updateStreak(todayStr) {
  const today = todayStr ?? new Date().toISOString().slice(0, 10);
  const streak = getStreak();

  if (streak.lastDate === today) return streak; // already counted today

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const updated = {
    count: streak.lastDate === yesterdayStr ? streak.count + 1 : 1,
    lastDate: today,
  };
  localStorage.setItem(KEYS.STREAK, JSON.stringify(updated));
  return updated;
}

// ─── Session state ────────────────────────────────────────────────────────────
// Stored in chrome.storage.session so it survives popup closes and tab switches
// but is automatically cleared when the browser restarts.

const SESSION_KEY = "dequeue_active_session";

/**
 * @typedef {Object} ActiveSession
 * @property {import('../core/knapsack.js').KnapsackItem[]} items - Remaining queue items in order
 * @property {number} pointsEarned - Points accumulated this session so far
 */

/**
 * Persists the active session so it survives popup close/reopen.
 * No-ops gracefully if chrome.storage is unavailable (e.g. unit tests).
 * @param {ActiveSession} session
 * @returns {Promise<void>}
 */
export function saveSession(session) {
  if (!globalThis.chrome?.storage?.session) return Promise.resolve();
  return chrome.storage.session.set({ [SESSION_KEY]: session });
}

/**
 * Retrieves the persisted session, or null if none exists.
 * @returns {Promise<ActiveSession | null>}
 */
export async function loadSession() {
  if (!globalThis.chrome?.storage?.session) return null;
  const result = await chrome.storage.session.get(SESSION_KEY);
  return result[SESSION_KEY] ?? null;
}

/**
 * Clears the persisted session (call on End Session or when all items are done).
 * @returns {Promise<void>}
 */
export function clearSession() {
  if (!globalThis.chrome?.storage?.session) return Promise.resolve();
  return chrome.storage.session.remove(SESSION_KEY);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Wipes all DeQueue data from localStorage.
 * Only used in tests and a future "reset" option — never called by normal app code.
 */
export function clearAll() {
  localStorage.removeItem(KEYS.ITEMS);
  localStorage.removeItem(KEYS.SETTINGS);
  localStorage.removeItem(KEYS.STREAK);
}
