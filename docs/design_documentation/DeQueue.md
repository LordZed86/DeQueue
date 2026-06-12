# DeQueue — Design Document

**Author:** Kellen Jones
**Course:** CS 398 — Algorithmic Problem Solving
**Last Updated:** 2026-06-11

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
│   ├── storage.js         # Thin wrapper around localStorage
│   └── scoring.js         # Value function — computes priority score for each item
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
 * @property {string}   [topic]         - User-assigned topic tag (e.g. "research", "fun")
 * @property {number}   interest        - User-assigned interest rating (1–5)
 * @property {string}   [mood]          - Optional mood/energy tag (e.g. "focus", "low-energy")
 * @property {string}   contentType     - "article" | "video" | "other"
 * @property {number}   addedAt         - Unix timestamp of when the item was saved
 * @property {number}   [completedAt]   - Unix timestamp of completion, null if pending
 * @property {boolean}  completed       - Whether the item has been consumed
 * @property {number}   priority        - Computed value score (see scoring.js) — not user-set
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

### Open Questions

- TODO: Do we want a `source` field to track where an item came from (manual, auto-scraped)?
- TODO: Should `topic` be a single tag or an array? Multiple tags are more flexible but complicate filtering UI.
- TODO: What's the upper bound on `timeEstimate`? A 3-hour documentary is technically valid but probably breaks UX assumptions. Early hallway feedback suggests a "long-form" mode for items > 60 min is worth exploring.
- TODO: `inProgress` flag is stored on the item — should it be cleared if the user deletes and re-adds an item? Currently no-ops correctly because delete removes the whole item.

---

## 3. Core Algorithm

### The Knapsack Problem

The session generator is a classic **0/1 knapsack**: given a set of items each with a weight (time) and value (priority score), select a subset that maximizes total value without exceeding a capacity (time budget).

- **Capacity** = user's time budget in minutes, capped at `MAX_BUDGET_MINUTES` (60)
- **Weight** of each item = `timeEstimate` (whole minutes; fractional weights not supported)
- **Value** of each item = computed `priority` score from `utils/scoring.js`

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
| `interest` | User-assigned (1–5) | Normalized to [0, 1] as `(rating - 1) / 4` |
| `recency` | Derived from `addedAt` | 1.0 today → 0.0 at 30 days (linear decay) |
| `staleness` | Derived from `addedAt` | Inverse of recency — items sitting longest get the boost; ceiling 30 days |
| `mood` match | User's current mood vs item's mood tag | Binary: 1.0 if match, 0 otherwise |

Each factor is normalized to [0, 1] before weighting so no factor can dominate by scale. Final score: `round(weighted_sum × 100)` → integer in [0, 100].

### Default weights

```js
export const DEFAULT_WEIGHTS = {
  interest: 0.5,
  recency: 0.2,
  staleness: 0.2,
  moodMatch: 0.1,
};
```

### Important: recency/staleness symmetry

Under equal weights, recency and staleness cancel each other out algebraically — the combined contribution is `0.2 × (1 - f) + 0.2 × f = 0.2` regardless of item age. To differentiate items by age, the weights must be asymmetric. This is a known open question for the options page.

### Open Questions

- TODO: Decay curve is currently linear. Logarithmic decay would age items more gently — worth experimenting with once hallway testing produces feedback.

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

### Open Questions

- TODO: YouTube's DOM changes frequently. Is it worth maintaining a YouTube-specific scraper or just fall back to manual time entry?
- TODO: Word count as a read-time proxy is rough — should we surface the estimate and let the user correct it?

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
  "dequeue_points"        → integer (total points; UI-layer state, not in Item model)

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

// Settings
getSettings()           // → Settings (merged with defaults; never throws)
saveSettings(patch)     // merge patch into existing settings

// Session persistence
saveSession(session)    // → Promise<void>  write active session to chrome.storage.session
loadSession()           // → Promise<ActiveSession | null>  restore on popup open
clearSession()          // → Promise<void>  remove on End Session or session complete

// Utility
clearAll()              // removes dequeue_items and dequeue_settings only
```

### Why not localStorage for session state?

`localStorage` persists indefinitely — if the browser crashed mid-session, a stale session object would linger and incorrectly restore on next open. `chrome.storage.session` is automatically scoped to the browser session, so it self-cleans at the right time without requiring explicit lifecycle management.

### Open Questions

- TODO: Do we need export/import (e.g. JSON backup)? Useful if the user switches browsers.
- TODO: How do we handle storage quota limits? `localStorage` is capped at ~5MB per origin.

---

## 8. UI / UX

### Popup (main interface)

The popup is the primary surface — it opens when the user clicks the extension icon.

**Views:**

1. **Queue view** — scrollable list of all pending items, with sort/filter controls
2. **Add item view** — form pre-filled with page metadata, user reviews and confirms
3. **Session view** — one item at a time, driven by `SessionQueue`; shows current item with Done and Skip buttons, plus a "N remaining" counter

**Controls:**

- Time budget input (in minutes) + "Generate Session" button
- Filter by topic, mood, content type
- Sort by recency, interest, staleness
- Done / Skip in session view
- Points counter in header (increments on Done)

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
- **Points counter in the header** — always visible, updates immediately on Done.
- **Gamification: points counter only for now** — 10 pts per completed item. Session complete screen shows points earned that session. No visual animations yet (P1).

### Open Questions

- TODO: How minimal is "minimal gamification"? Any visual feedback on completion beyond the count?

---

## 9. Testing Plan

### Current test suite (136 tests, all passing)

<!--prettier-ignore-->
| File | Tests | What it covers |
| --- | --- | --- |
| `core/knapsack.test.js` | 17 | DP vs. brute-force agreement, edge cases, known optimal solutions |
| `utils/scoring.test.js` | 17 | Each factor in isolation, output range, weight system, `scoreItems` immutability |
| `utils/storage.test.js` | 29 | All CRUD operations, settings merge, corrupt-data resilience, `clearAll` scoping |
| `core/queue.test.js` | 23 | `peek`/`dequeue`/`skip`/`toArray`, skip cycling, `buildSessionQueue` sort order |
| `content/content.test.js` | 37 | Metadata extraction (title, description, type, duration, topic), duration parsers |
| `core/pipeline.test.js` | 13 | Full pipeline integration (scoreItems → knapsack → queue), stress tests 50–100 items |

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
| 2 | Single topic tag vs. array of tags | Open |
| 3 | Value function weights — hardcoded defaults or user-configurable? | **Decided: user-configurable via options page weight sliders** |
| 4 | Decay curve shape (linear vs. logarithmic) | Open |
| 5 | Max supported time budget | **Decided: 60 minutes** |
| 6 | localStorage vs. IndexedDB to start | **Decided: localStorage** |
| 7 | Export/import of item data | Open (P2) |
| 8 | YouTube-specific scraper — worth maintaining? | Open |
| 9 | Gamification — points counter only, or visual feedback too? | **Decided: counter only for P0** (10 pts/item, shown in header and session complete screen) |
| 10 | Recency vs. staleness weight asymmetry — which direction should the default favor? | Open |
| 11 | DP table approach — 1D rolling array vs. 2D | **Decided: 2D** (backtracking requires full row history) |
| 12 | Session presentation — one at a time vs. full list | **Decided: one at a time** (reduces choice paralysis) |
| 13 | Skip behavior — discard or cycle to back? | **Decided: cycle to back** (item stays available this session) |
| 14 | Session state storage — localStorage vs. chrome.storage.session | **Decided: chrome.storage.session** — right lifecycle: survives popup close/tab switch, auto-clears on browser restart. localStorage would persist stale sessions across restarts. |

## TODO Checklist

P0 (MVP — required to have a working app)

- [x] manifest.json — the extension config
- [x] src/popup/popup.html + popup.js + popup.css — the main UI (3 views: queue list, add item form, session view)
- [x] src/content/content.js — content script that scrapes page metadata to pre-fill the add form
- [x] src/background/background.js — service worker for messaging between popup and content script
- [x] src/assets/icons/ — SVG icon (placeholder; PNG exports pending)

P0 Tests

- [x] Stress test: 50–100 items at various budgets (`core/pipeline.test.js`)
- [x] Integration test: scoring → knapsack → queue pipeline end-to-end (`core/pipeline.test.js`)
- [x] UI/popup: add item persists, completed items excluded, points counter increments (hallway testing)
- [x] Session persistence across popup close/tab switch (chrome.storage.session)

P1 (post-MVP polish)

- [x] src/options/ — options page (weight sliders, default budget, mood picker)
- [x] Sorting/filtering UI (by topic, recency, mood) + sort by priority/interest/recency/time
- [x] In-progress flag for interrupted items — pins item to top of queue with badge on next open
- [ ] Hallway testing (general usability + ADHD-appropriateness)

P2 (stretch)

- [ ] Auto-fill from reading lists/YouTube, calendar integration, topic clustering, algorithm visualizer, stats
