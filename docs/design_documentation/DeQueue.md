# DeQueue — Design Document

**Author:** Kellen Jones
**Course:** CS 398 — Algorithmic Problem Solving
**Last Updated:** 2026-06-25

---

## 1. Architecture Overview

DeQueue is a browser extension built on the WebExtensions API, targeting Firefox and Chrome/Brave as P0, with Safari as a stretch goal.

### Extension Components

A WebExtension is made up of several distinct scripts that each run in different contexts and have different permissions:

```plaintext
src/
├── manifest.json          # Extension config — declares permissions, entry points
├── background/
│   └── background.js      # Service worker; runs persistently in the background
│                          # Handles storage reads/writes and cross-component messaging
├── content/
│   └── content.js         # Injected into active web pages
│                          # Responsible for scraping metadata from the current tab
├── popup/
│   ├── popup.html         # The UI that appears when the extension icon is clicked
│   ├── popup.js           # Drives the popup — session generator, item list, filtering
│   └── popup.css
├── options/
│   ├── options.html       # Settings page (value function weights, preferences)
│   ├── options.js
│   └── options.css
├── core/
│   ├── knapsack.js        # 0/1 knapsack DP — selects which items fit the budget
│   │                      # Pure function: no DOM, no storage, no side effects
│   └── queue.js           # SessionQueue — presents knapsack output one item at a time
├── utils/
│   ├── storage.js         # Thin wrapper around localStorage + chrome.storage.session
│   ├── scoring.js         # Value function — computes priority score for each item
│   └── achievements.js    # Achievement definitions and unlock logic
└── assets/
    └── icons/             # Extension icon at various sizes (16, 48, 128px)
```

### Data Flow (Adding an Item)

```plaintext
User clicks extension icon on a webpage
  → popup.js sends GET_PAGE_META to background.js (MV3 requires this relay)
  → background.js forwards the message to content.js on the active tab
  → content.js scrapes the page and returns { title, url, description, estimatedTime, ... }
  → popup.js pre-fills the "Add Item" form with that metadata
  → User reviews/edits and confirms
  → popup.js calls saveItem() from utils/storage.js
```

### Data Flow (Generating a Session)

```plaintext
User opens popup, sets a time budget
  → popup.js calls getPendingItems() from utils/storage.js
  → popup.js calls scoreItems(items, { currentMood }) from utils/scoring.js
  → popup.js calls knapsack(budget, scoredItems) from core/knapsack.js
  → popup.js calls buildSessionQueue(result.selected) from core/queue.js
  → popup.js awaits saveSession() → writes queue snapshot to chrome.storage.session
  → popup.js renders the session view, showing queue.peek() as the current item
  → User clicks Done → queue.dequeue(), markCompleted(id) in storage, saveSession() updated
  → User clicks Skip → queue.skip(), saveSession() updated (item moves to back, stays in session)
  → User clicks End Session / all items done → clearSession() removes session from chrome.storage.session
```

### Data Flow (Restoring a Session After Popup Close)

```plaintext
User closes popup (e.g. clicks a link, opens a new tab)
  → active session is already persisted in chrome.storage.session

User reopens popup
  → init calls loadSession() from utils/storage.js
  → if a session exists: restores SessionQueue from saved item list, jumps straight to session view
  → if no session: shows the queue view as normal
```

---

## 2. Data Model

### Item

Each saved item is an object with the following shape:

```js
/**
 * @typedef {Object} Item
 * @property {string}   id              - Unique ID (generated on creation)
 * @property {string}   url             - Source URL
 * @property {string}   title           - Display title
 * @property {string}   [description]   - Short summary or excerpt
 * @property {number}   timeEstimate    - Estimated time to complete, in whole minutes
 * @property {string}   [topic]         - User-assigned topic tag (e.g. "research", "fun") — single tag, not an array (Resolved, see §10)
 * @property {number}   interest        - Interest rating 1–3 (1 = low, 2 = neutral/default, 3 = high). Optional at save time — defaults to 2 if the user doesn't touch it (Resolved, see §10)
 * @property {string}   contentType     - "article" | "video" | "other"
 * @property {number}   addedAt         - Unix timestamp of when the item was saved
 * @property {number}   [completedAt]   - Unix timestamp of completion, null if pending
 * @property {boolean}  completed       - Whether the item has been consumed
 * @property {number}   value           - Computed priority score (see scoring.js) — not user-set; attached by scoreItems(), not part of the stored item
 */
```

### Settings

User preferences stored in localStorage under `dequeue_settings`:

```js
/**
 * @typedef {Object} Settings
 * @property {number}  defaultBudget  - Default time budget shown in popup (minutes); default 20
 * @property {string}  [defaultMood]  - Pre-selected mood tag; null means none
 * @property {ScoringWeights} [weights] - Custom scoring weights; null means use defaults
 */
```

### Resolved: `weight` / `timeEstimate` duplication

Previously every saved item stored both `weight` (used by the knapsack) and `timeEstimate` (used by the UI) with the same value. `weight` has been removed from the stored item shape — `scoreItems()` now derives `weight: item.timeEstimate` at scoring time, so there's a single source of truth on disk.

### Resolved: `mood` removed from item shape

Items no longer carry a `mood` field at all. See §5 ("Mood: per-item tag removed, session-time bias only") for the full rationale — in short, asking the user to predict their future mood when saving an item created a two-moments problem where the guess almost never paid off, which worked against the app's anti-paralysis premise. Mood is now a session-time-only input (`Settings.defaultMood` above and the `currentMood` scoring option), never something stored per item.

### Open Questions

- **Long-form items (>60 min)**: handled as a separate "long-form library" outside the knapsack (P2). Items over the 60-minute cap are filtered before the DP table is built, so they're effectively invisible to the current session generator. The long-form library surfaces them separately when the user has open-ended time.

---

## 3. Core Algorithm

### The Knapsack Problem

The session generator is a classic **0/1 knapsack**: given a set of items each with a weight (time) and value (priority score), select a subset that maximizes total value without exceeding a capacity (time budget).

- **Capacity** = user's time budget in minutes, capped at `MAX_BUDGET_MINUTES` (60)
- **Weight** of each item = `timeEstimate` (whole minutes; fractional weights not supported)
- **Value** of each item = computed `.value` score from `utils/scoring.js`

The algorithm lives entirely in `core/knapsack.js` and has no dependencies on storage, the DOM, or any other module.

### Implementation

Bottom-up DP with a 2D table and backtracking. The 2D table (rather than the space-optimized 1D rolling array) was chosen because backtracking requires the full row history, and the 60-minute cap keeps the table small.

```js
// dp[i][w] = best value using items 0..i-1 with capacity w
const dp = Array.from({ length: n + 1 }, () => new Int32Array(cap + 1));

for (let i = 1; i <= n; i++) {
  const item = candidates[i - 1];
  for (let w = 0; w <= cap; w++) {
    if (item.weight > w) {
      dp[i][w] = dp[i - 1][w];
    } else {
      dp[i][w] = Math.max(
        dp[i - 1][w],
        dp[i - 1][w - item.weight] + item.value
      );
    }
  }
}

// Backtrack to recover which items were selected
let w = cap;
for (let i = n; i >= 1; i--) {
  if (dp[i][w] !== dp[i - 1][w]) {
    selected.push(candidates[i - 1]);
    w -= candidates[i - 1].weight;
  }
}
```

### Key decisions

- **Max budget: 60 minutes.** The use case is gap-filling (waiting rooms, lunch breaks), not day-planning. 60 minutes keeps the table small and the UX honest.
- **Items with `weight < 1` or `weight > cap` filtered before the table is built.** Zero-weight items would be selected for free every time. Items over the cap can never fit.
- **`knapsackBruteForce` exported alongside `knapsack`.** Used in tests to verify the DP result against an exhaustive 2^n search on small inputs.

### Correctness Verification

The DP solution is verified against `knapsackBruteForce` on multiple small inputs (≤15 items) in `knapsack.test.js`. Both must agree on `totalValue` for any given input/budget pair.

---

## 4. Session Queue

After the knapsack selects which items to include, `core/queue.js` wraps the result in a `SessionQueue` that presents items one at a time.

### Why a queue?

The knapsack answers _which_ items fit the budget. The queue answers _how to present them_ — one at a time, in priority order, with a skip mechanism. Surfacing a single item reduces choice paralysis, which is the same problem the whole app is designed to address.

It also gives the app its name: the user literally **dequeues** from **DeQueue**.

### API

```js
const queue = buildSessionQueue(knapsackResult.selected);
// Items are sorted by descending value — highest priority first

queue.peek(); // → current item (or null if empty)
queue.dequeue(); // → remove and return front item (Done)
queue.skip(); // → move front item to back (Skip — stays in session)
queue.size; // → number of items remaining
queue.isEmpty; // → true when session is complete
queue.toArray(); // → snapshot of remaining items (for "1 of N" display)
```

### Session flow from the user's perspective

```plaintext
Session starts → show queue.peek() as the current item
  Done  → queue.dequeue(), markCompleted(id) in storage, show next peek()
  Skip  → queue.skip(), show next peek()
  (item cycles back and will appear again)
Session ends when queue.isEmpty is true → show completion state
```

---

## 5. Scoring / Value Function

Each item's priority score is computed by `utils/scoring.js` and attached as `.value` before being passed to the knapsack.

### Inputs to the score

<!--prettier-ignore-->
| Factor | Source | Notes |
| --- | --- | --- |
| `interest` | User-assigned (1–3, optional, defaults to 2) | Normalized to [0, 1] as `(clamp(rating, 1, 3) - 1) / 2`; unset treated as 2 |
| `recency` | Derived from `addedAt` | 1.0 today → 0.0 at 30 days (linear decay) |
| `staleness` | Derived from `addedAt` | Inverse of recency — items sitting longest get the boost; ceiling 30 days (fixed, see §10) |
| `mood` bias | User's current session mood (no per-item mood tag — see below) | "low-energy"/"fun" favor lower `timeEstimate`; "focus"/"curious" favor higher `interest`; no mood selected is neutral (0.5) for every item |

Each factor is normalized to [0, 1] before weighting so no factor can dominate by scale. Final score: `round(weighted_sum × 100)` → integer in [0, 100].

### Default weights

```js
export const DEFAULT_WEIGHTS = {
  interest: 0.5,
  recency: 0.1,
  staleness: 0.3,
  moodMatch: 0.1,
};
```

### Resolved: recency/staleness asymmetry

Recency and staleness are opposing forces (new-first vs. old-first). Under **equal** weights they cancel out algebraically — the combined contribution is `w × (1 - f) + w × f = w` regardless of item age, so age has zero effect on score no matter how large `w` is; only the _difference_ between the two weights matters. Resolved by making staleness win by default (`0.3` vs. `0.1`) so forgotten old items get surfaced instead of perpetually losing to new saves — the app's core purpose is fighting the guilt pile. Both remain user-adjustable via the options page sliders.

### Interest rating: 5 stars → optional 3-point toggle

The original 1–5 star picker required a deliberate calibration decision on every save and was a required field. That's exactly the kind of task-initiation friction the app is designed to remove, and `interest` carries the heaviest default weight (0.5) — an avoided or arbitrary rating there undermined the whole score. Replaced with an optional 3-point scale (Low / Neutral / High) shown as two toggle buttons that nudge away from a neutral default (2); pressing the active button again returns to neutral. Not interacting with it at all is a fully valid, zero-friction choice — the item is saved with `interest: 2` and scores as neutral on that axis.

### Mood: per-item tag removed, session-time bias only

Mood was previously captured at two moments with no reason to agree: once at save time (`item.mood` — a guess at what mood the item would suit, made days or weeks before it would ever be opened) and once at session-generation time (`currentMood` — the user's actual mood right now). Scoring rewarded only an exact match between the two (`moodMatch: 0.1`, binary). Predicting your own future mood correctly across 4 presets is close to a coin flip, so tagging an item's mood at save-time was more likely to hurt its ranking than help it — precisely the kind of speculative micro-decision the app exists to remove, and it directly echoed the interest-rating problem above.

`item.mood` and the add-item mood field are gone entirely, along with the queue-view mood filter (which depended on `item.mood` and would otherwise have gone permanently dead). The session-time mood selector survives — `mood-select` on the queue view, plus `Settings.defaultMood` — and now biases scoring using signals every item already has instead of a per-item tag:

- **"low-energy" / "fun"** → favor lower `timeEstimate` (`1 - min(timeEstimate / MAX_BUDGET_MINUTES, 1)`)
- **"focus" / "curious"** → favor higher `interest` (reuses the normalized interest score)
- **No mood selected** → neutral 0.5 for every item, same non-penalizing default pattern used for interest

### Other resolved Tier 1 questions

- **Staleness ceiling**: kept fixed at 30 days. The four scoring weights are already user-adjustable via the options page sliders — that's the intended tuning knob; a second adjustable ceiling would add settings complexity for marginal benefit.
- **Topic**: single tag, not an array — matches the existing schema/UI; an array would need a migration and a tag-input UI rework.

### Open Questions

- **Decay curve**: currently linear. Logarithmic would age items more gently. Deferred to P2 weight experimentation UI.

---

## 6. Metadata Extraction

The content script (`content/content.js`) runs on the active tab when the user opens the popup and clicks "Add this page." It attempts to read metadata from the page's HTML before asking the user to fill anything in manually.

### What to try to extract

<!--prettier-ignore-->
| Field | Where to look |
| --- | --- |
| Title | `og:title` → `<title>` tag |
| Description | `og:description` → `meta[name=description]` |
| Content type | URL pattern (youtube.com → video), `og:type` |
| Estimated time (video) | YouTube DOM (`.ytp-time-duration`), `VideoObject` JSON-LD schema |
| Estimated time (article) | `twitter:data1` (Medium uses this), word count of `<article>` ÷ ~200 wpm |
| Topic hints | `article:tag`, `keywords` meta, or `og:section` |

### Approach

- Try to extract everything automatically
- Pre-fill the form with whatever was found
- Let the user override anything before saving
- Never block saving on failed extraction — manual entry is always the fallback

### Resolved: content script not injected on some pages

Root cause confirmed: content scripts can't be injected into restricted pages (`chrome://`, `about:`, extension/store pages) or into tabs that were already open before the extension was installed/reloaded — this is a browser-level restriction, not something fixable from the manifest. In those cases `background.js` hits its `chrome.runtime.lastError` branch and returns null. Previously the form just stayed silently empty; now the add-item view shows a neutral inline hint ("Couldn't read this page — enter details manually") distinguishing that case from a real error, so manual entry doesn't feel like a mystery failure.

### Open Questions

- **YouTube scraper**: implemented as best-effort (DOM `.ytp-time-duration` → `VideoObject` JSON-LD). YouTube's DOM changes frequently. Tracked as "monitor but don't overinvest" — fall back to manual time entry when it breaks.
- **Word count as read-time proxy**: rough but practical. The form lets the user correct the estimate before saving, which is the right escape hatch.

---

## 7. Storage

All data lives on the user's machine. No backend, no accounts.

### Implementation

`utils/storage.js` is a thin wrapper around two storage mechanisms:

- **`localStorage`** — permanent item and settings data. Survives browser restarts. All item CRUD and settings go here.
- **`chrome.storage.session`** — active session state only. Cleared automatically when the browser restarts, but survives popup close/reopen and tab switches within a browser session. This is the right lifecycle for "I'm in a session right now."

Nothing else in the app touches either storage API directly — all reads and writes go through `storage.js`.

### Schema

```plaintext
localStorage:
  "dequeue_items"         → JSON array of Item objects
  "dequeue_settings"      → JSON object of user preferences
  "dequeue_points"        → integer (total points earned; via getPoints/addPoints in storage.js)
  "dequeue_streak"        → { count: number, lastDate: "YYYY-MM-DD" }
  "dequeue_achievements"  → JSON array of unlocked achievement ID strings

chrome.storage.session:
  "dequeue_active_session" → { items: KnapsackItem[], pointsEarned: number }
                             Present only while a session is active; removed on End Session
                             or when all items are completed.
```

### Public API

```js
// Items
getItems()              // → Item[]  (never throws; returns [] on error)
getPendingItems()       // → Item[]  (completed items excluded — use this for the knapsack)
saveItem(item)          // append
updateItem(item)        // replace by id (no-op if not found)
deleteItem(id)          // remove by id (no-op if not found)
markCompleted(id, ts?)  // set completed=true, completedAt=ts (defaults to Date.now())
getTotalCompleted()     // → number  count of all completed items (for achievements)

// Settings
getSettings()           // → Settings (merged with defaults; never throws)
saveSettings(patch)     // merge patch into existing settings

// Streak
getStreak()             // → { count, lastDate }
updateStreak(todayStr?) // call on each item completion; increments or resets

// Achievements
getUnlockedAchievements() // → Set<string>  IDs of unlocked achievements
unlockAchievement(id)     // adds id to the unlocked set

// Session persistence
saveSession(session)    // → Promise<void>  write active session to chrome.storage.session
loadSession()           // → Promise<ActiveSession | null>  restore on popup open
clearSession()          // → Promise<void>  remove on End Session or session complete

// Utility
clearAll()              // removes all dequeue_* localStorage keys
```

### Why not localStorage for session state?

`localStorage` persists indefinitely — if the browser crashed mid-session, a stale session object would linger and incorrectly restore on next open. `chrome.storage.session` is automatically scoped to the browser session, so it self-cleans at the right time without requiring explicit lifecycle management.

### Points

Points are stored under `KEYS.POINTS` (`"dequeue_points"`) and accessed via `getPoints()` and `addPoints(n)` in `storage.js`. `clearAll()` removes the key. All reads and writes go through `storage.js` — nothing in `popup.js` touches `localStorage` directly.

### Open Questions

- **Export/import**: planned as P2 — JSON backup/restore. Format TBD (plain JSON or Pocket/Instapaper compatible).
- **Storage quota**: `localStorage` is capped at ~5MB per origin. Not a concern for current usage patterns, but a migration path to IndexedDB is already available since all access goes through `storage.js`.

---

## 8. UI / UX

### Popup (main interface)

The popup is the primary surface — it opens when the user clicks the extension icon.

**Views:**

1. **Queue view** — scrollable list of all pending items, with sort/filter controls
2. **Add item view** — form pre-filled with page metadata, user reviews and confirms
3. **Session view** — one item at a time, driven by `SessionQueue`; shows current item with Done and Skip buttons, plus a "N remaining" counter

**Controls:**

- Time budget input (in minutes) + session mood picker + "Generate Session" button
- Filter by topic
- Sort by priority, interest, recency, time
- Done / Skip in session view
- Points counter + 🔥 streak counter in header (both update on Done)
- 🏅 achievements button opens achievements panel

### Session view detail

The session view shows one item at a time (not a full list) to reduce choice paralysis. The user sees:

- Item title and URL
- Estimated time
- "1 of N" progress indicator (from `queue.toArray().length`)
- **Done** — marks completed, advances queue
- **Skip** — moves to back of queue, advances to next item

### Options Page

Accessible via the gear button in the popup header or from the browser's extension settings page. Shipped controls:

- Default time budget (minutes)
- Default mood picker
- Four scoring weight sliders (interest, recency, staleness, mood match) — auto-normalized so they always sum to 1; live % labels update as the sliders move
- Reset to defaults button

Remaining / future:

- Points/gamification settings
- Data export/import

### Decisions made during implementation

- **Single view at a time with a back button** — no persistent nav. Keeps the popup minimal and focused.
- **Points counter + streak in the header** — always visible, both update immediately on Done.
- **Session summary screen** — on session complete shows items completed, points earned, and current streak message.
- **Gamification: points, streak, achievements** — 10 pts per completed item; day-streak tracked in localStorage; 6 milestone achievements (first item, 5 items, 25 items, 3-day streak, 7-day streak, speed run). Toast notification fires on unlock; panel accessible via 🏅 button.
- **In-progress resume prompt** — when a session is generated and an item is flagged in-progress, a confirm dialog asks the user to resume it or skip it for this session.

---

## 9. Testing Plan

### Current test suite (163 tests, all passing)

<!--prettier-ignore-->
| File | Tests | What it covers |
| --- | --- | --- |
| `core/knapsack.test.js` | 17 | DP vs. brute-force agreement, edge cases, known optimal solutions |
| `utils/scoring.test.js` | 22 | Each factor in isolation (interest clamping/neutral-default, mood bias per preset), output range, weight system, `scoreItems` immutability |
| `utils/storage.test.js` | 35 | All CRUD operations, settings merge, corrupt-data resilience, `clearAll` scoping, streak logic |
| `core/queue.test.js` | 23 | `peek`/`dequeue`/`skip`/`toArray`, skip cycling, `buildSessionQueue` sort order |
| `content/content.test.js` | 42 | Metadata extraction (title, description, type, duration, topic), duration parsers, `cleanDocumentTitle` |
| `core/pipeline.test.js` | 14 | Full pipeline integration (scoreItems → knapsack → queue), stress tests 50–100 items |
| `utils/achievements.test.js` | 10 | Each achievement condition, duplicate-unlock prevention, empty-stats base case |

### Not unit tested (and why)

- **`background.js`** — pure Chrome API wiring with no logic of its own. Testing it would mean mocking `chrome.tabs.query` and asserting that we called the mock — not a meaningful correctness check.
- **`popup.js`** — DOM manipulation glue over already-tested modules. Meaningful coverage requires a real extension runtime or a component framework with stable seams. Flagged for integration testing.

### Remaining test work

- ~~**Stress test:** 50–100 items at various budgets~~ ✓ done — `core/pipeline.test.js`; 100 items at max budget runs in <1ms
- ~~**Integration:** scoring → knapsack → queue pipeline end-to-end~~ ✓ done — `core/pipeline.test.js`
- **UI / popup:** adding an item persists across close/reopen; completed items excluded from future sessions; points counter increments (hallway testing)

### Hallway Testing

- External tester (non-technical user) for general usability
- Domain expert (wife, ADHD psychology background) for ADHD-appropriateness of the UX

---

## 10. Open Questions & Decisions Log

<!--prettier-ignore-->
| # | Question | Status |
| --- | --- | --- |
| 1 | Safari support — P2 stretch or cut entirely? | **Decided: P2 stretch** |
| 2 | Single topic tag vs. array of tags | **Decided: single tag** — matches existing schema/UI; array deferred, would need a migration + tag-input UI rework |
| 3 | Value function weights — hardcoded defaults or user-configurable? | **Decided: user-configurable via options page weight sliders with auto-normalization** |
| 4 | Decay curve shape (linear vs. logarithmic) | Open — logarithmic would age items more gently; deferred to P2 weight experimentation UI |
| 5 | Max supported time budget | **Decided: 60 minutes** — gap-filling use case, not day-planning |
| 6 | localStorage vs. IndexedDB to start | **Decided: localStorage** — all access behind `storage.js` so migration is a single-file change |
| 7 | Export/import of item data | **Decided: P2** — JSON export/import planned; format TBD (plain JSON or Pocket/Instapaper compatible) |
| 8 | YouTube-specific scraper — worth maintaining? | Open — implemented as best-effort; falls back to manual if YouTube's DOM changes |
| 9 | Gamification — points counter only, or visual feedback too? | **Decided: points + streak + achievements shipped** — 10 pts/item, 🔥 streak in header, 6 milestone achievements with toast notifications and panel UI |
| 10 | Recency vs. staleness weight asymmetry — which direction should the default favor? | **Decided: staleness wins** — `DEFAULT_WEIGHTS` set to `recency: 0.1, staleness: 0.3`; favoring old items matches the app's anti-guilt-pile purpose |
| 11 | DP table approach — 1D rolling array vs. 2D | **Decided: 2D** — backtracking requires full row history to recover which items were selected |
| 12 | Session presentation — one at a time vs. full list | **Decided: one at a time** — reduces choice paralysis, which is the same problem the whole app addresses |
| 13 | Skip behavior — discard or cycle to back? | **Decided: cycle to back** — item stays available this session, never forces the user into a dead end |
| 14 | Session state storage — localStorage vs. chrome.storage.session | **Decided: chrome.storage.session** — survives popup close/tab switch, auto-clears on browser restart; localStorage would persist stale sessions |
| 15 | Long-form items (>60 min) — force into algorithm or separate space? | **Decided: separate long-form library (P2)** — items outside the knapsack presented when the user has open-ended time; removes decision anxiety without breaking the budget model |
| 16 | Mood — fixed presets vs. free-text tag? | **Decided: fixed presets** (focus, low-energy, curious, fun) — superseded by #19, presets remain but only as a session-time input |
| 17 | Staleness ceiling — fixed 30 days vs. user-adjustable? | **Decided: fixed at 30 days** — the scoring weights are already the user-adjustable tuning knob |
| 18 | Interest rating — 5-point stars vs. lighter-weight signal? | **Decided: optional 3-point toggle** (Low/Neutral/High), defaults to neutral, no longer required to save — reduces save-time decision friction; see §5 |
| 19 | Mood — per-item tag at save time, or session-time input only? | **Decided: session-time only** — a per-item mood tag asked the user to predict their future mood days/weeks ahead of opening the item, an easy-to-get-wrong speculative decision; `item.mood` and the mood filter are removed, the session mood picker now biases scoring via `timeEstimate`/`interest` instead of exact-matching a tag; see §5 |

---

## 11. Known Bugs & Pre-release Cleanup

The extension shipped as v1.0.0. The following issues were identified through hallway testing and a code audit and must be resolved before publishing to the Chrome Web Store or Firefox Add-ons.

### P1 — User-visible bugs

**Session not reliably restoring after popup close** ✅ Fixed 2026-06-25
`persistSession()` is now called immediately after reconstructing the `SessionQueue` from a saved session on popup open. The snapshot stays fresh across multiple close/reopen cycles without having to advance the session first.

**Item not marked "visited" when URL is opened** ✅ Fixed 2026-06-25
`cardUrl.onclick` now calls `markInProgress(item.id)` each time `renderSessionCard()` draws a new item. The flag fires before the browser follows the link, so re-opening the popup after clicking a URL correctly surfaces the interrupted item at the top of the queue.

**Autofill title hit-or-miss on some sites** ✅ Mitigated 2026-07-02
Root cause confirmed: content scripts can't inject on restricted pages or tabs opened before the extension loaded — a browser-level limitation, not fixable from the manifest. The add-item view now shows a neutral inline hint when autofill can't read the page, so it no longer reads as a silent, unexplained failure. See Section 6 for detail.

### Pre-release cleanup — resolved 2026-06-25

All four items below were fixed before the first publish attempt. Listed here for the record.

- ✅ **`dequeue_points` bypasses `storage.js`**: moved into `storage.js` — `KEYS.POINTS`, `getPoints()`, `addPoints()`, and `clearAll()` now cover it.
- ✅ **Debug log in production init**: `console.log("[DeQueue] restored session:")` removed from `popup.js`.
- ✅ **`weight` / `timeEstimate` duplication**: `weight` removed from the saved item shape. `scoreItems()` now derives `weight: item.timeEstimate` before passing items to the knapsack — single source of truth.
- ✅ **`markInProgress` bypasses `setItems` helper**: fixed to use `setItems` consistently with every other write in `storage.js`.

---

## 12. Multi-platform Strategy

DeQueue is designed to expand beyond the browser extension. This section captures the porting decisions so they're made once and applied consistently.

### What's portable vs. platform-bound

DeQueue splits into two layers:

1. **The engine** — knapsack solver, scoring, session queue, storage contract. Pure logic, no DOM, no browser APIs. This is the same algorithm regardless of platform and should be ported faithfully with its tests, including the brute-force oracle pattern.
2. **The capture mechanism** — how items get into the system. Entirely platform-specific: content scripts on the extension, OS share sheet on mobile, TBD on desktop.

UI, storage backend, and capture UX are platform-specific and should be built idiomatically per platform rather than forced into a shared abstraction.

### Platform build order

1. **Extension (v1.x.x)** — shipped. Fix P1 bugs and pre-release cleanup, then publish to Chrome Web Store and Firefox Add-ons.
2. **iOS** — first new platform. Share sheet capture, hybrid HTML-parse/webview extraction, engine translated to Swift with tests.
3. **Android** — port the proven iOS architecture to Kotlin/Jetpack Compose.
4. **Desktop (Win/Mac/Linux)** — capture strategy open until mobile's hybrid approach is validated; likely reuses lessons from mobile.

### Why native per platform (not React Native / Flutter)

The hardest part of this app on mobile is OS-level integration: share extensions, webview content extraction, possibly background processing. Those integration points have fewer rough edges in native code than through a cross-platform bridge. Since that integration layer is the riskiest technical surface, native-per-platform reduces risk where it matters most.

### Mobile capture

Primary path: OS share sheet (iOS/Android). The share sheet delivers a bare URL, so metadata extraction still needs to happen. Approach: try raw fetch + HTML parse first (fast, works for most server-rendered content). If the result is empty or suspiciously short (sign of a JS-rendered shell), fall back to a hidden `WKWebView` (iOS) / `WebView` (Android) render pass — same capability as the extension's content script, just without a visible tab.

Readability.js runs inside the hidden webview and the result is pulled out via the JS bridge, rather than reimplementing those parsing heuristics natively.

### Desktop capture

Not yet decided. Options include: app fetches URL directly (fails on SPAs/paywalls), extension + desktop communicate via local storage, or hidden webview approach borrowed from mobile once that's proven. Decision deferred until mobile architecture is validated.

### Theming across platforms

The CSS variable structure (`--color-bg`, `--color-accent`, etc.) is intentionally swappable — themes are `:root` block swaps. Native apps won't reuse CSS but should define an equivalent design-token system (e.g. a `Theme` struct/object with the same semantic slots) so theme-swapping stays equally cheap. The design principle travels: soft pastels on dark backgrounds, low visual noise, calm over stimulating.
