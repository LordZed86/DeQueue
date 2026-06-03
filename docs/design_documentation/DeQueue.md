# DeQueue — Design Document

**Author:** Kellen Jones
**Course:** CS 398 — Algorithmic Problem Solving
**Last Updated:** 2026-06-03

---

## 1. Architecture Overview

DeQueue is a browser extension built on the WebExtensions API, targeting Firefox and Chrome/Brave as P0, with Safari as a stretch goal.

### Extension Components

A WebExtension is made up of several distinct scripts that each run in different contexts and have different permissions:

```Plaintext
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
│   └── knapsack.js        # Pure algorithmic logic — no DOM, no storage, no side effects
│                          # This is the heart of the project
├── utils/
│   └── storage.js         # Thin wrapper around IndexedDB/localStorage
│   └── scoring.js         # Value function — computes priority score for each item
└── assets/
    └── icons/             # Extension icon at various sizes (16, 48, 128px)
```

### Data Flow (Adding an Item)

```plaintext
User clicks extension icon on a webpage
  → popup.js sends a message to content.js asking for page metadata
  → content.js scrapes the page and returns { title, url, description, estimatedTime, ... }
  → popup.js pre-fills the "Add Item" form with that metadata
  → User reviews/edits and confirms
  → popup.js sends the new item to background.js
  → background.js writes to storage
```

### Data Flow (Generating a Session)

```plaintext
User opens popup, sets a time budget
  → popup.js reads all items from storage via background.js
  → popup.js calls knapsack(budget, items) from core/knapsack.js
  → knapsack returns an ordered selection of items
  → popup.js renders the session list
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

### Open Questions

- TODO: Do we want a `source` field to track where an item came from (manual, auto-scraped)?
- TODO: Should `topic` be a single tag or an array? Multiple tags are more flexible but complicate filtering UI.
- TODO: What's the upper bound on `timeEstimate`? A 3-hour documentary is technically valid but probably breaks UX assumptions.

---

## 3. Core Algorithm

### The Knapsack Problem

The session generator is a classic **0/1 knapsack**: given a set of items each with a weight (time) and value (priority score), select a subset that maximizes total value without exceeding a capacity (time budget).

- **Capacity** = user's time budget in minutes (integer)
- **Weight** of each item = `timeEstimate` (rounded to nearest minute on input)
- **Value** of each item = computed `priority` score (see Scoring section below)

The algorithm lives entirely in `core/knapsack.js` and has no dependencies on storage, the DOM, or any other module. This makes it easy to test in isolation.

### Approach

Standard bottom-up DP. Build a 2D table `dp[i][w]` = best value using items `0..i` with capacity `w`.

```js
// pseudocode — you'll implement this
for each item i:
  for each capacity w from maxBudget down to item.weight:
    dp[w] = max(dp[w], dp[w - item.weight] + item.value)
```

After the table is filled, backtrack to identify which items were selected.

### Correctness Verification

Verify the DP solution against a brute-force exhaustive search on small inputs (≤15 items). The brute-force tries all 2^n subsets — too slow for real use but a reliable ground truth for testing.

### Open Questions

- TODO: Decide on the DP table granularity. Minutes are fine for now — revisit if users want sub-minute precision.
- TODO: What happens when no item fits in the budget? Return empty set with a user-facing message.
- TODO: What's the max budget we want to support? Caps the table size. 480 minutes (8 hours) seems reasonable.

---

## 4. Scoring / Value Function

Each item's `priority` score is computed by `utils/scoring.js` before being passed to the knapsack. This is where the "smarter" part lives.

### Inputs to the Score

| Factor       | Source                                 | Notes                                                         |
| ------------ | -------------------------------------- | ------------------------------------------------------------- |
| `interest`   | User-assigned (1–5)                    | Direct signal of how much they want to see this               |
| `recency`    | Derived from `addedAt`                 | Newer items get a small boost                                 |
| `staleness`  | Derived from `addedAt`                 | Items sitting too long gradually gain priority (decay factor) |
| `mood` match | User's current mood vs item's mood tag | Bonus if they match                                           |

### Open Questions

- TODO: How do we weight these factors relative to each other? This needs experimentation.
- TODO: Should weights be user-configurable in the options page, or keep it simple and hardcode reasonable defaults?
- TODO: Define the decay curve — linear? logarithmic? Should there be a ceiling so items don't dominate just from age?

---

## 5. Metadata Extraction

The content script (`content/content.js`) runs on the active tab when the user opens the popup and clicks "Add this page." It attempts to read metadata from the page's HTML before asking the user to fill anything in manually.

### What to Try to Extract

| Field                    | Where to look                                                            |
| ------------------------ | ------------------------------------------------------------------------ |
| Title                    | `og:title` → `<title>` tag                                               |
| Description              | `og:description` → `meta[name=description]`                              |
| Content type             | URL pattern (youtube.com → video), `og:type`                             |
| Estimated time (video)   | YouTube DOM (`.ytp-time-duration`), `VideoObject` JSON-LD schema         |
| Estimated time (article) | `twitter:data1` (Medium uses this), word count of `<article>` ÷ ~200 wpm |
| Topic hints              | `article:tag`, `keywords` meta, or `og:section`                          |

### Approach

- Try to extract everything automatically
- Pre-fill the form with whatever was found
- Let the user override anything before saving
- Never block saving on failed extraction — manual entry is always the fallback

### Open Questions

- TODO: YouTube's DOM changes frequently. Is it worth maintaining a YouTube-specific scraper or just fall back to manual time entry?
- TODO: Word count as a read-time proxy is rough — should we surface the estimate and let the user correct it?

---

## 6. Storage

All data lives on the user's machine. No backend, no accounts.

### Strategy

- Start with `localStorage` for simplicity (synchronous, easy to debug)
- Migrate to `IndexedDB` if the item list grows large or if we need indexed queries
- All storage access goes through `utils/storage.js` so the rest of the app doesn't care which one is in use

### Schema (localStorage version)

```plaintext
"dequeue_items"    → JSON array of Item objects
"dequeue_settings" → JSON object of user preferences
```

### Open Questions

- TODO: Do we need export/import (e.g. JSON backup)? Useful if the user switches browsers.
- TODO: How do we handle storage quota limits? `localStorage` is capped at ~5MB per origin.

---

## 7. UI / UX

### Popup (main interface)

The popup is the primary surface — it opens when the user clicks the extension icon.

**Views:**

1. **Queue view** — scrollable list of all pending items, with sort/filter controls
2. **Add item view** — form pre-filled with page metadata, user reviews and confirms
3. **Session view** — generated session result after running the knapsack

**Controls:**

- Time budget input (in minutes) + "Generate Session" button
- Filter by topic, mood, content type
- Sort by recency, interest, staleness
- Mark item as done (triggers points)

### Options Page

Accessible from the browser's extension settings. Lower-traffic controls:

- Value function weight sliders (if we expose them)
- Points/gamification settings
- Data export/import

### Open Questions

- TODO: Should the popup have a persistent nav or just one view at a time with a back button?
- TODO: Where does the points counter live — always visible in the popup header?
- TODO: How minimal is "minimal gamification"? Just a number for now, or do we want any visual feedback on completion?

---

## 8. Testing Plan

### Algorithmic Correctness

- **Known small sets** — hand-compute the optimal selection, verify the DP matches
- **Brute-force comparison** — for inputs ≤15 items, assert DP result equals exhaustive search
- **Edge cases:**
  - Empty item list
  - Single item (fits / doesn't fit)
  - Budget of zero
  - All items exceed budget
  - All items have identical value scores
  - Duplicate time estimates

### Stress Testing

- 50–100 items, various budgets — verify DP table performance is acceptable
- Verify the DP table doesn't blow up memory on large budgets (e.g. 480 minutes)

### UI / Integration

- Adding an item persists across popup close/reopen
- Completed items don't appear in future sessions
- Filtering narrows the candidate set before the knapsack runs
- Points counter increments correctly on completion

### Hallway Testing

- External tester (non-technical user) for general usability
- Domain expert feedback on ADHD-appropriateness of the UX

---

## 9. Open Questions & Decisions Log

A running list of unresolved decisions. Move entries out of here and into the relevant section once decided.

| #   | Question                                                          | Status |
| --- | ----------------------------------------------------------------- | ------ |
| 1   | Safari support — P2 stretch or cut entirely?                      | Open   |
| 2   | Single topic tag vs. array of tags                                | Open   |
| 3   | Value function weights — hardcoded defaults or user-configurable? | Open   |
| 4   | Decay curve shape (linear vs. logarithmic)                        | Open   |
| 5   | Max supported time budget (caps DP table size)                    | Open   |
| 6   | localStorage vs. IndexedDB to start                               | Open   |
| 7   | Export/import of item data                                        | Open   |
| 8   | YouTube-specific scraper — worth maintaining?                     | Open   |
| 9   | Gamification — points counter only, or visual feedback too?       | Open   |
