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

_This log will be updated as each new file or feature is built._
