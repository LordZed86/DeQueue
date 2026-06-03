# DeQueue — Development Log

A chronological record of decisions made, problems hit, and bugs found for each file as the project was built. Intended to support the final reflection and project defense.

---

## Project Setup & Design

### What was done

- Established the project as a browser extension (WebExtensions API) targeting Firefox and Chrome/Brave
- Chose the 0/1 knapsack problem via bottom-up DP as the core algorithm
- Set up ESLint, Prettier, and Vite as the toolchain
- Wrote the full design document (`docs/design_documentation/DeQueue.md`)
- Defined the `Item` data model, data flow diagrams, and scoring factor list
- Scaffolded the `src/` directory structure

### Key decisions

- **Browser extension over web app:** Wanted the "add this page" flow to feel native — an extension lets us inject content scripts to scrape page metadata automatically. A web app would require copy-paste.
- **Client-side only, no backend:** Keeps the app simple, preserves user privacy, and eliminates hosting costs. All data stays in the user's browser.
- **Knapsack as the core algorithm:** The core ADHD problem is "I have 20 minutes, which one thing should I pick?" — this is literally a capacity-constrained optimization problem. Knapsack is the right fit.
- **Minutes as the DP unit:** Finer granularity (seconds) would explode the table size. Minutes are natural for the user anyway ("this article takes about 10 minutes").
- **ESM modules:** The project uses `"type": "module"` in package.json, so all files use `import`/`export` syntax.

### Open questions logged

- Single topic tag vs. array of tags
- Whether to expose value function weights as user settings or hardcode defaults
- Max supported time budget (caps the DP table size)
- localStorage vs. IndexedDB
- YouTube-specific metadata scraper — worth maintaining?

---

## Core Algorithm & Scoring

### Files created

- `src/core/knapsack.js`
- `src/utils/scoring.js`
- `src/core/knapsack.test.js`
- `src/utils/scoring.test.js`

### `src/core/knapsack.js`

#### Decisions

- **2D DP table over 1D rolling array:** The 1D space-optimized approach makes backtracking harder because you lose the per-row history needed to reconstruct which items were chosen. Since the budget cap is 60 minutes, the table is at most 60 columns wide — memory is not a concern. The 2D version is also much easier to read and reason about, which matters for a class project where the algorithm needs to be explainable.
- **Max budget capped at 60 minutes:** The app's purpose is to fill _gaps_ in a day (waiting room, lunch break, between meetings) — not to plan a full reading marathon. 60 minutes is a natural upper bound for that use case. Can be raised based on user feedback.
- **Items with weight < 1 filtered before the table is built:** A zero-weight item would be selected for free every time and throw off the DP. Fractional weights are also not supported (all time estimates are in whole minutes).
- **`knapsackBruteForce` exported alongside `knapsack`:** The design doc explicitly called for brute-force verification on small inputs. Exporting it from the same module keeps it easy to import in tests.
- **`Int32Array` for DP rows:** Slightly more memory-efficient than a plain JS array of numbers for integer values.

#### Bugs / surprises

- None in the implementation. The algorithm worked correctly on the first run.

---

### `src/utils/scoring.js`

#### Decisions

- **Score normalized to [0, 100] integer:** Knapsack "value" is typically an integer in textbook examples. Normalizing to a 0–100 range makes the score human-readable if it ever appears in the UI, and rounding to an integer keeps the DP values clean.
- **Four scoring factors: interest, recency, staleness, moodMatch:** These map directly to the factors named in the design doc. Recency and staleness are intentionally opposite signals — recency boosts new items, staleness boosts items that have been sitting too long. Together they pull the queue toward balance.
- **Staleness ceiling at 30 days:** Items older than 30 days are treated as equally stale. Without a ceiling, a 6-month-old item would dominate the queue unfairly. 30 days felt like a natural "this has been sitting too long" threshold.
- **Weights in `DEFAULT_WEIGHTS` constant, not hardcoded inline:** Makes them easy to override per-call (for testing) and easy to wire up to the options page later.
- **`scoreItems()` returns new objects, does not mutate originals:** Standard practice. The caller should not have to worry about their original array being modified.

#### Bugs / surprises

- None in the implementation.

---

### `src/core/knapsack.test.js`

#### Bugs found during testing

- **Test bug (not algorithm bug):** The "picks items that maximize value, not the two lightest" test had a wrong hand-computed answer in the comment. The test expected `totalValue = 60` (items b+a), but the actual optimum for that input was `totalValue = 65` (items a+c). The DP was correct — the test assertion was wrong. Fixed by correcting the expected value and updating the comment.

#### Test coverage rationale

- **DP vs. brute-force agreement on 4 different inputs:** This is the primary correctness check called out in the design doc. If both algorithms agree on the same total value across varied inputs, the DP is almost certainly correct.
- **Edge cases (empty list, budget 0, all items over budget, exact fit, one minute over, weight-0 filter, MAX_BUDGET cap):** These cover the specific failure modes listed in the design doc's testing plan.
- **Known optimal solutions:** A few hand-verified cases where we know the right answer and can assert specific values, not just DP==brute-force agreement.

---

### `src/utils/scoring.test.js`

#### Bugs found during testing

- **Test bug — recency vs. staleness cancellation:** The initial recency test asserted that a fresh item scores higher than a 15-day-old item. At 15 days (halfway to the 30-day staleness ceiling), the recency contribution and the staleness contribution exactly cancel out under `DEFAULT_WEIGHTS` (both are weight 0.2 and their normalized scores are mirror images). The scores were equal, not ordered.
  - First fix attempt: changed 15 days to 29 days. Still tied — because the cancellation is algebraic, not dependent on the specific age.
  - Root cause: with equal weights, `recency + staleness = 0.2 * (1 - f) + 0.2 * f = 0.2` regardless of `f`. The combined contribution is constant.
  - Final fix: wrote the test using custom weights that zero out staleness (and shift that weight to recency) to isolate the factor being tested.

#### Design insight surfaced by this bug

- In production, with `DEFAULT_WEIGHTS`, recency and staleness neutralize each other — a day-old item and a month-old item score the same from those two factors. The only way one age wins over another is if the weights are asymmetric. This is a real design question: should staleness weight be higher than recency so that old items gradually bubble up? **Worth revisiting during the options page design.**

#### Test coverage rationale

- **Output range:** Confirms the score is always an integer in [0, 100], no matter what inputs are given.
- **Each factor tested in isolation:** Interest, recency, staleness, and mood match each have at least one test that isolates them (using custom weights) so a regression in one factor doesn't hide behind the others.
- **Custom weights + zero weights:** Verifies the weighting system works as a multiplier and that zero weights produce zero contribution.
- **`DEFAULT_WEIGHTS` sums to 1:** Ensures the normalization assumption holds. If someone adds a new factor and forgets to rebalance, this test catches it.
- **`scoreItems` immutability:** Confirms originals are not mutated — a common subtle bug when spreading objects.

---

## Vitest setup

**Date:** 2026-06-03

- Installed `vitest` as a dev dependency
- Updated `package.json` to set `"test": "vitest run"` and added `"test:watch": "vitest"` for interactive development
- Vitest was chosen over Jest because the project already uses Vite — they share config, both handle ESM natively, and no extra Babel/transform setup is needed

---

---

## Storage Layer

**Date:** 2026-06-03

### Files created

- `src/utils/storage.js`
- `src/utils/storage.test.js`

### `src/utils/storage.js`

#### Decisions

- **localStorage over IndexedDB to start:** localStorage is synchronous and requires almost no setup — read a string, parse JSON, done. IndexedDB is async, requires transaction management, and is significantly more code. For a list of dozens of items, localStorage is plenty. The design doc explicitly planned for this migration path; `storage.js` is the single place it would happen.
- **Two keys only:** `dequeue_items` (JSON array) and `dequeue_settings` (JSON object). Simple, predictable, easy to inspect in DevTools.
- **`getItems()` never throws:** Wraps the `localStorage.getItem` + `JSON.parse` in a try/catch and returns `[]` on any failure. Corrupt storage should not crash the extension.
- **`getPendingItems()` as the knapsack entry point:** Completed items must be excluded before the algorithm runs. This filter lives in storage so callers don't have to remember to do it.
- **`saveSettings()` merges, not overwrites:** Callers can update one setting field without needing to read and re-write everything else. Prevents accidental data loss if settings grow over time.
- **`clearAll()` only removes DeQueue keys:** Does not call `localStorage.clear()` — that would wipe any other data the browser has stored under the extension origin. Scoped removal is safer.
- **`setItems()` is not exported:** It's an internal helper used by `saveItem`, `updateItem`, `deleteItem`, and `markCompleted`. Exposing it would let callers bypass the read-modify-write cycle and accidentally corrupt the list.

#### Bugs / surprises

- None. All 29 tests passed on the first run.

### `src/utils/storage.test.js`

#### Setup

- Storage tests need a real `localStorage` implementation. Vitest runs in Node by default, which has no `localStorage`. Added `@vitest-environment jsdom` as a per-file docblock so only this test file gets the browser environment — the algorithm tests continue running in Node (faster).
- Installed `jsdom` as a dev dependency to support the jsdom environment.
- `beforeEach(() => clearAll())` ensures every test starts with a clean store. Without this, test order would matter and tests could interfere with each other.

#### Test coverage rationale

- **`getItems` with corrupt JSON:** localStorage can technically hold any string. If someone manually edits it or the write was interrupted, `JSON.parse` would throw. The test confirms we return `[]` gracefully instead of crashing.
- **`updateItem` and `deleteItem` no-ops:** Both functions are called with an id. If the id doesn't exist (item was already deleted, or a stale reference), they must not throw and must not corrupt the list.
- **`markCompleted` timestamp:** Two tests — one that passes an explicit timestamp (verifiable), one that checks the default `Date.now()` falls within a before/after bracket. The bracket approach avoids flakiness from timing.
- **`clearAll` does not touch unrelated keys:** Protects against accidentally nuking other browser data stored at the same origin.

---

---

## Session Queue

**Date:** 2026-06-03

### Files created

- `src/core/queue.js`
- `src/core/queue.test.js`

### `src/core/queue.js`

#### The idea

The knapsack returns a flat array of selected items. Wrapping that in a queue lets the popup surface one item at a time — which is more ADHD-friendly than showing the full list and asking the user to choose where to start. It's also a direct nod to the app name: you literally **dequeue** from **DeQueue**.

#### Decisions

- **Class-based (`SessionQueue`):** A class with internal state (`_items`) is the clearest way to model a mutable queue — each method either reads or transforms the internal list. A functional approach (pure functions over an array) would have worked but would require the caller to pass the array back in on every call.
- **`skip()` moves to the back instead of discarding:** If a user isn't in the mood for the current item, they shouldn't lose it — it cycles to the back and comes around again. This matches how ADHD users actually work: "not right now, but still this session."
- **`peek()` returns `null` on empty (not an error):** The popup needs to know when the queue is exhausted to show a "session complete" state. Returning `null` is the natural signal; throwing would force every call site to use try/catch.
- **`toArray()` returns a copy:** Callers can read the queue's contents for UI purposes (e.g. "1 of 4" progress) without being able to accidentally mutate the internal array.
- **`buildSessionQueue()` sorts by descending value:** The highest-priority item surfaces first. Within a session, the user should encounter the most important thing while their attention is freshest.
- **`_items` is private by convention (underscore prefix):** JavaScript doesn't enforce private fields without `#`, but the underscore signals clearly to future contributors that this array should not be touched directly.

#### Bugs / surprises

- None. All 23 tests passed on the first run.

### `src/core/queue.test.js`

#### Test coverage rationale

- **`skip()` cycling test:** Three skips on a 3-item queue should return to the original front item. Verifies that skip is a true rotation, not a destructive operation.
- **`skip()` on single-item queue:** Edge case — the item should stay at the front and size should remain 1. Without this test, a naive implementation that used `shift()` + `push()` on a length-1 array could accidentally behave differently.
- **`toArray()` immutability:** Confirms that modifying the returned array doesn't touch the internal queue state — a common subtle bug when returning array references.
- **`buildSessionQueue` sort order:** Checked both the full order and that `peek()` matches the highest-value item, as these are the two things the popup will actually use.
- **Equal values:** Doesn't assert a specific order (that would be fragile) — just confirms no error is thrown when the sort comparator returns 0.

---

_This log will be updated as each new file or feature is built._
