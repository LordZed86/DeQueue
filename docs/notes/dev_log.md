# DeQueue — Development Log

A chronological record of decisions made, problems hit, and bugs found for each file as the project was built. Intended to support the final reflection and project defense.

---

## Project Setup & Design

### What was done

- Established the project as a browser extension (WebExtensions API) targeting Firefox and Chrome/Brave
- Chose the 0/1 knapsack problem via bottom-up DP as the core algorithm
- Set up ESLint, Prettier, and Vite as the toolchain
- Wrote the initial design document (`docs/design_documentation/DeQueue.md`)
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

## Vitest Setup

- Installed `vitest` as a dev dependency
- Updated `package.json` to set `"test": "vitest run"` and added `"test:watch": "vitest"` for interactive development
- Vitest was chosen over Jest because the project already uses Vite — they share config, both handle ESM natively, and no extra Babel/transform setup is needed

---

## Core Algorithm & Scoring

### Files created

- `src/core/knapsack.js`
- `src/utils/scoring.js`
- `src/core/knapsack.test.js`
- `src/utils/scoring.test.js`

---

### `src/core/knapsack.js`

#### Decisions

- **2D DP table over 1D rolling array:** The 1D space-optimized approach makes backtracking harder because you lose the per-row history needed to reconstruct which items were chosen. Since the budget cap is 60 minutes, the table is at most 60 columns wide — memory is not a concern. The 2D version is also much easier to read and reason about, which matters for a class project where the algorithm needs to be explainable.
- **Max budget capped at 60 minutes:** The app's purpose is to fill _gaps_ in a day (waiting room, lunch break, between meetings) — not to plan a full reading marathon. 60 minutes is a natural upper bound for that use case. Can be raised based on user feedback.
- **Items with weight < 1 filtered before the table is built:** A zero-weight item would be selected for free every time and throw off the DP. Fractional weights are also not supported (all time estimates are in whole minutes).
- **`knapsackBruteForce` exported alongside `knapsack`:** The design doc explicitly called for brute-force verification on small inputs. Exporting it from the same module keeps it easy to import in tests.
- **`Int32Array` for DP rows:** Slightly more memory-efficient than a plain JS array of numbers for integer values.

#### Bugs / surprises

- The core DP structure was adapted from a standard textbook implementation and adjusted to fit the project — the main work was adding backtracking, the zero-weight filter, and the MAX_BUDGET cap on top of the base algorithm.
- **Test bug (not algorithm bug):** The "picks items that maximize value, not the two lightest" test had a wrong hand-computed expected value in the comment — asserted `totalValue = 60` (items b+a) when the actual optimum was `totalValue = 65` (items a+c). The DP was correct; the test assertion was wrong. Caught because DP and brute-force agreed with each other but not with the hardcoded expected value.

---

### `src/utils/scoring.js`

#### Decisions

- **Score normalized to [0, 100] integer:** Knapsack "value" is typically an integer in textbook examples. Normalizing to a 0–100 range makes the score human-readable if it ever appears in the UI, and rounding to an integer keeps the DP values clean.
- **Four scoring factors: interest, recency, staleness, moodMatch:** These map directly to the factors named in the design doc. Recency and staleness are intentionally opposite signals — recency boosts new items, staleness boosts items that have been sitting too long. Together they pull the queue toward balance.
- **Staleness ceiling at 30 days:** Items older than 30 days are treated as equally stale. Without a ceiling, a 6-month-old item would dominate the queue unfairly. 30 days felt like a natural "this has been sitting too long" threshold.
- **Weights in `DEFAULT_WEIGHTS` constant, not hardcoded inline:** Makes them easy to override per-call (for testing) and easy to wire up to the options page later.
- **`scoreItems()` returns new objects, does not mutate originals:** Standard practice. The caller should not have to worry about their original array being modified.

#### Bugs / surprises

- **Recency and staleness cancel each other out under equal weights:** The initial recency test asserted that a fresh item scores higher than a 15-day-old item. At 15 days the recency and staleness contributions exactly cancelled — both are weight 0.2 and their normalized scores are mirror images. Changing 15 days to 29 days didn't fix it either. Root cause: with equal weights, `recency + staleness = 0.2 × (1 - f) + 0.2 × f = 0.2` regardless of item age. The combined contribution is a constant. Fixed by writing the test with custom weights that zero out staleness to isolate the factor being tested.
- **Design implication:** In production with `DEFAULT_WEIGHTS`, a day-old item and a month-old item score identically on the recency/staleness axis. The weights need to be asymmetric to actually differentiate by age. This is now an open design question for the options page.

---

## Storage Layer

### Files created

- `src/utils/storage.js`
- `src/utils/storage.test.js`

---

### `src/utils/storage.js`

#### Decisions

- **localStorage over IndexedDB to start:** localStorage is synchronous and requires almost no setup — read a string, parse JSON, done. IndexedDB is async, requires transaction management, and is significantly more code. For a list of dozens of items, localStorage is plenty. The design doc explicitly planned for this migration path; `storage.js` is the single place it would happen.
- **`getItems()` never throws:** Wraps the `localStorage.getItem` + `JSON.parse` in a try/catch and returns `[]` on any failure. Corrupt storage should not crash the extension.
- **`getPendingItems()` as the knapsack entry point:** Completed items must be excluded before the algorithm runs. This filter lives in storage so callers don't have to remember to do it.
- **`saveSettings()` merges, not overwrites:** Callers can update one setting field without needing to read and re-write everything else. Prevents accidental data loss if settings grow over time.
- **`clearAll()` only removes DeQueue keys:** Does not call `localStorage.clear()` — that would wipe any other data the browser has stored under the extension origin. Scoped removal is safer.
- **`setItems()` is not exported:** It's an internal helper used by `saveItem`, `updateItem`, `deleteItem`, and `markCompleted`. Exposing it would let callers bypass the read-modify-write cycle and accidentally corrupt the list.

#### Bugs / surprises

- None. The module's invariants were clear from the design doc and translated directly into code without surprises.

---

### `src/utils/storage.test.js`

#### Setup

- Storage tests need a real `localStorage` implementation. Vitest runs in Node by default, which has no `localStorage`. Added `@vitest-environment jsdom` as a per-file docblock so only this test file gets the browser environment — the algorithm tests continue running in Node.
- `beforeEach(() => clearAll())` ensures every test starts with a clean store. Without this, test order would matter and tests could interfere with each other.

#### Test coverage rationale

- **`getItems` with corrupt JSON:** localStorage can technically hold any string. If someone manually edits it or the write was interrupted, `JSON.parse` would throw. The test confirms we return `[]` gracefully instead of crashing.
- **`updateItem` and `deleteItem` no-ops:** Both functions are called with an id. If the id doesn't exist (item was already deleted, or a stale reference), they must not throw and must not corrupt the list.
- **`markCompleted` timestamp:** Two tests — one that passes an explicit timestamp (verifiable), one that checks the default `Date.now()` falls within a before/after bracket. The bracket approach avoids flakiness from timing.
- **`clearAll` does not touch unrelated keys:** Protects against accidentally nuking other browser data stored at the same origin.

---

## Session Queue

### Files created

- `src/core/queue.js`
- `src/core/queue.test.js`

---

### `src/core/queue.js`

#### The idea

The knapsack returns a flat array of selected items. Wrapping that in a queue lets the popup surface one item at a time — which is more ADHD-friendly than showing the full list and asking the user to choose where to start. It's also a direct nod to the app name: you literally **dequeue** from **DeQueue**.

#### Decisions

- **Class-based (`SessionQueue`):** A class with internal state (`_items`) is the clearest way to model a mutable queue — each method either reads or transforms the internal list. A functional approach would have worked but would require the caller to pass the array back in on every call.
- **`skip()` moves to the back instead of discarding:** If a user isn't in the mood for the current item, they shouldn't lose it — it cycles to the back and comes around again. This matches how ADHD users actually work: "not right now, but still this session."
- **`peek()` returns `null` on empty (not an error):** The popup needs to know when the queue is exhausted to show a "session complete" state. Returning `null` is the natural signal; throwing would force every call site to use try/catch.
- **`toArray()` returns a copy:** Callers can read the queue's contents for UI purposes (e.g. "1 of 4" progress) without being able to accidentally mutate the internal array.
- **`buildSessionQueue()` sorts by descending value:** The highest-priority item surfaces first. Within a session, the user should encounter the most important thing while their attention is freshest.

#### Bugs / surprises

- None. The queue contract was fully specified in the design doc before implementation started, so the code was essentially transcribing the spec which was adapted from my implementation in data structures class.

---

## Extension Scaffold & Popup

### Files created

- `vite.config.js`
- `src/manifest.json`
- `src/popup/popup.html`
- `src/popup/popup.css`
- `src/popup/popup.js`

---

### `vite.config.js`

#### Decisions

- **Minimal config pointing at `src/manifest.json`:** The project already had `vite-plugin-web-extension` installed. The plugin reads the manifest and handles output structure, hot-reload, and bundling for the extension. No additional config needed.

---

### `src/manifest.json`

#### Decisions

- **Manifest V3:** Required for Chrome; Firefox supports it too. MV3 is the current standard and the one that will be maintained going forward.
- **Permissions: `storage`, `activeTab`, `scripting`:** Minimum required set. `activeTab` + `scripting` lets the content script run on the current tab when triggered from the popup without requesting broad host permissions on install — better for user trust.
- **`"type": "module"` on the service worker:** Matches the ESM setup already in the project. Without this the background script can't use `import`.
- **`options_page` over `options_ui`:** Opens as a full tab; `options_ui` embeds in the browser's extension settings page with layout constraints. Full tab gives more control.

---

### `src/popup/popup.html`

#### Decisions

- **Three `<section>` elements, one visible at a time:** Simpler than a multi-page SPA. All views are in the DOM at load; `popup.js` toggles `hidden` class to switch between them. No routing needed.
- **Star rating uses `<button>` elements:** Accessible and keyboard-navigable. An `<input type="hidden">` holds the integer value for the form submit handler.
- **`<a>` with `target="_blank" rel="noopener noreferrer"` for session card URL:** Opens in a new tab (expected behavior from an extension popup) and avoids the `opener` security issue.

---

### `src/popup/popup.js`

#### Decisions

- **Full pipeline wired in `generateSession()`:** `getPendingItems()` → `scoreItems()` → `knapsack()` → `buildSessionQueue()`. This matches the data flow diagram in the design doc exactly.
- **Points stored under `dequeue_points` directly in localStorage, not through `storage.js`:** Points are a UI-layer concern, not part of the item data model. Keeping them out of `storage.js` avoids polluting the data layer with display state.
- **Content script pre-fill routed through `chrome.runtime.sendMessage`:** In MV3 the popup cannot message content scripts directly — all cross-context messaging must go through the background service worker.

#### Bugs / surprises

- **`crypto.randomUUID()` not available in popup context:** Calling `crypto.randomUUID()` directly threw a reference error. `(globalThis.crypto ?? self.crypto).randomUUID()` also failed because `self` isn't defined in the popup context. Fixed with `globalThis.crypto.randomUUID()`. The inconsistency between extension contexts (popup vs. service worker vs. content script) with Web APIs is something that bites you until you know it and then bites you again.

---

## Background Service Worker

### Files created

- `src/background/background.js`

---

### `src/background/background.js`

#### Decisions

- **Worker only handles messaging, not storage:** All storage reads and writes still go through `utils/storage.js` in the popup. The background worker's only job is to relay `GET_PAGE_META` requests from the popup to the content script on the active tab.
- **`return true` in the `onMessage` listener:** This is a required MV3 pattern when `sendResponse` is called asynchronously. Without it, the message channel closes before the async response arrives and the popup gets nothing — a completely silent failure with no error message, no exception, just an empty response. Easy to forget, genuinely hard to debug. Worse then the my favorite error in C, segfault!
- **`onInstalled` does nothing beyond logging:** `storage.js` initializes defaults lazily on first read, so there's no setup work to do at install time.

#### Bugs / surprises

- **The `return true` requirement was not obvious:** The MV3 docs mention it but it took a while to find. The symptom was that the popup's "Add Item" form never pre-filled — the content script ran fine, returned metadata, but the popup received `undefined`. Only after reading the MV3 messaging docs carefully did the missing `return true` surface as the cause.

#### Why no unit tests

The entire function body is Chrome API calls chained together (`chrome.tabs.query` → `chrome.tabs.sendMessage` → `sendResponse`). There is no branching logic of my own. Testing it would require mocking the Chrome APIs and asserting I called the mocks in the right order — which is just testing that I wrote the code, not that it's correct. Real bugs in this code only surface in an actual extension runtime. There might even still be some bugs that crawl out in the future.

---

## Content Script

### Files created

- `src/content/content.js`
- `src/content/content.test.js`

---

### `src/content/content.js`

#### Decisions

- **Each extractor returns `null` on failure, never throws:** The popup treats `null` as "leave this field blank." A failed extraction should never block the user from saving an item manually.
- **`chrome.runtime.onMessage` guarded by `typeof chrome !== "undefined"`:** Without this guard, importing the module in Node/jsdom (for tests) throws immediately because `chrome` doesn't exist. The guard makes the module safely importable outside a browser extension context.
- **Pure functions exported alongside the listener:** `extractTitle`, `extractContentType`, `parseDurationString`, etc. are all exported so they can be unit tested in isolation. The message listener is just the entry point.
- **`innerText` falls back to `textContent`:** `innerText` is a layout-dependent browser API not implemented in jsdom. The source uses `item.innerText ?? item.textContent` so word-count estimation works in both a real browser and in tests.

#### Bugs / surprises

- **`??` and `||` cannot be mixed in the same expression without parentheses:** (I cannot stress this enough) `document.title?.trim() ?? null` caused a rolldown parse error when `??` and `||` appeared at the same precedence level. Fixed by wrapping: `(document.title?.trim() || null)`.
- **`document.title` returns `""` in jsdom, not `null`:** The `??` operator only catches `null` and `undefined`, not empty strings. An empty title string was slipping through as-is instead of falling through to `null`. Changed to `|| null`.

---

### `src/content/content.test.js`

#### Test environment

- `@vitest-environment jsdom` per-file docblock — same pattern as `storage.test.js`. The content script's DOM queries need a browser-like environment.

#### Bugs found during testing

- **`window.location` is read-only in jsdom:** jsdom's `window.location` cannot be assigned. The three hostname-based content type tests (youtube.com, youtu.be, vimeo.com) couldn't simulate different URLs. Rewrote them to use `og:type` meta tags to trigger the video code path instead. The hostname regex branches are correct by inspection.
- **`innerText` not implemented in jsdom:** Word-count tests returned `null` because `article.innerText` was `undefined`. Fixed in the source with the `textContent` fallback (see above).
- **`twitter:title` attribute mismatch:** The test used `name="twitter:title"` but the source queries `property="twitter:title"`. Twitter meta tags use `property`, not `name` — easy to mix up when copying from og: examples.

---

## Session Persistence

### Problem

The popup is a browser window — it is destroyed every time it closes. Clicking a link in the session view opens a new tab, which closes the popup. When the user reopened the extension, `sessionQueue` (a plain JS variable) was gone, and the UI defaulted back to the queue view asking them to generate a new session.

### Solution

Added `saveSession`, `loadSession`, and `clearSession` to `utils/storage.js` using `chrome.storage.session`. The init block in `popup.js` now checks for a saved session on every popup open and restores it directly into a `SessionQueue`.

### Files changed

- `src/utils/storage.js` — added session persistence API (three functions)
- `src/popup/popup.js` — async init, `persistSession()` called on generate/Done/Skip, `clearSession()` on End Session and session complete

### Key decisions

- **`chrome.storage.session` over localStorage:** localStorage persists indefinitely — a crashed session would incorrectly restore on next open. `chrome.storage.session` is automatically scoped to the browser session and self-cleans on restart.
- **Save on generate, not just on Done/Skip:** The session must be written before the user clicks the first link, which closes the popup. Waiting until Done/Skip would be too late.
- **`SessionQueue` constructed directly in restore path:** Not through `buildSessionQueue`, which would re-sort already-ordered data.

### Bugs / surprises

- **Missing `await` on `saveSession` caused a silent race condition:** The first implementation didn't `await` the `saveSession` call inside `generateSession`. The popup could close before the async write completed, leaving nothing in storage to restore. The symptom was intermittent — sometimes session restored, sometimes it didn't, depending on how fast the user clicked. Fixed by making `generateSession` and `persistSession` fully async. This one was subtle because it only manifested when the popup closed quickly after session generation.

---

## Sort/Filter UI, Options Page, In-Progress Flag

### Files changed

- `src/popup/popup.html` — filter bar (topic, mood, sort dropdowns); gear button in header
- `src/popup/popup.js` — filter/sort state, `applyFilterSort()`, `populateTopicFilter()`, settings button wiring, in-progress flag on End Session
- `src/popup/popup.css` — filter bar layout, in-progress badge + card highlight, icon button, points flex spacing
- `src/utils/storage.js` — added `markInProgress(id)` and `clearInProgress()`
- `src/manifest.json` — added `options_page`
- `src/options/options.html` — new file
- `src/options/options.js` — new file
- `src/options/options.css` — new file

---

### Sort/filter bar

#### Decisions

- **Three dropdowns in a compact bar:** topic filter, mood filter, sort order. Placed directly below the queue header so it's always visible without consuming a separate view.
- **Topic dropdown auto-populated from items:** Scans pending items for unique non-null `topic` values and builds the `<option>` list dynamically. If the user has no topics tagged, the dropdown just shows "All topics" — no dead UI.
- **Sort piggybacks on `scoreItems()`:** The "By priority" sort already scores items using the current mood selection, so the sort and session generation stay in sync.
- **In-progress item always pins to top regardless of sort:** A secondary sort pass puts `inProgress: true` items first.
- **Item count shows "X of Y items" when filtered:** Communicates to the user that they're seeing a subset, not the whole queue.

#### Bugs / surprises

- None. `scoreItems` was already importable in `popup.js` so the sort-by-priority path required zero new imports.

---

### Options page (`src/options/`)

#### Decisions

- **Weight sliders with live % labels:** Each slider shows its current value as a percentage next to the label. Updates on `input` event so the label tracks the thumb in real time.
- **Auto-normalization on save:** The four raw slider values are divided by their sum, so stored weights always sum to 1.0. The user dials factors up/down relative to each other without needing to think about percentages summing to 100.
- **`saveSettings` merge semantics reused:** Options page patches only the three settings fields it owns. No risk of clobbering other settings fields added later.

#### Bugs / surprises

- None. The build picked up `src/options/options.html` automatically once `options_page` was added to the manifest — `vite-plugin-web-extension` handles all entry points declared in the manifest.

---

### In-progress flag

#### Decisions

- **Flag stored on the item in localStorage:** `inProgress: boolean` on the item object via `markInProgress(id)`. At most one item is flagged at a time — `markInProgress` clears all other flags before setting the new one.
- **Set on End Session, cleared on Done:** End Session flags the item currently shown. Done clears any flag — the item is done so the flag is irrelevant.
- **Visual: red border + "In Progress" badge:** Consistent with the extension's accent color language (accent = important/active).
- **Pins above sort order, not as a separate section:** A secondary sort after the main sort ensures the in-progress item always appears first without needing a separate UI zone.

---

## Streak, Session Summary, In-Progress Resume, Site Compatibility, Achievements

### Files changed

- `src/utils/storage.js` — added `KEYS.STREAK`, `KEYS.ACHIEVEMENTS`; streak and achievement functions; `clearAll()` updated
- `src/utils/achievements.js` — new file; 6 achievement milestones and `checkAchievements()`
- `src/utils/achievements.test.js` — new file; 10 tests
- `src/utils/storage.test.js` — 8 new streak tests
- `src/content/content.js` — added `cleanDocumentTitle()` and integrated into `extractTitle()` fallback
- `src/content/content.test.js` — 6 new `cleanDocumentTitle` tests; updated `extractTitle` fallback test
- `src/popup/popup.html` — streak in header; achievements button + panel; toast element; session summary lines
- `src/popup/popup.js` — streak display, `checkAndUnlock()`, achievements panel, in-progress resume confirm dialog
- `src/popup/popup.css` — header stats, streak, toast, achievements panel styles

---

### Streak tracking

#### Decisions

- **`lastDate` stored as "YYYY-MM-DD" string:** Timezone-safe and human-readable in DevTools. Timestamps would require conversion to compare calendar days correctly.
- **`updateStreak` accepts an optional `todayStr` override:** Makes the function testable without mocking `Date`. Tests pass explicit date strings; production passes nothing and uses `new Date().toISOString().slice(0, 10)`.
- **Stored in localStorage, not `chrome.storage.session`:** Streaks span days and must survive browser restarts.

---

### Session summary

#### Decisions

- **Show items completed, points earned, and streak on session complete:** More satisfying than just a points number. Streak message uses different text for day 1 vs. continuation.
- **`sessionItemsCompleted` tracked in popup state:** Not derivable from the queue (which is empty by session end). Incremented on each Done click.

---

### In-progress resume prompt

#### Decisions

- **`confirm()` dialog on Generate Session:** Native browser confirm is accessible, requires no new UI, and is appropriately modal. The prompt text includes the item title.
- **"No" keeps the in-progress flag:** The item remains flagged for next time.
- **Budget reduction when resuming:** `Math.max(0, budget - item.timeEstimate)` subtracts the in-progress item's time before running knapsack so the total session still fits the budget.

---

### Site compatibility — `cleanDocumentTitle`

#### Problem

Wikipedia and many other sites don't set `og:title` — only `document.title`. Their titles include a site-name suffix: "Article Name - Wikipedia", "Story | The Guardian". These suffixes cluttered the add-item form.

#### Solution

`cleanDocumentTitle(raw)` strips the last `" - Site Name"` / `"| Site Name"` / `"– Site Name"` segment with a single regex. Applied only in the `document.title` fallback — `og:title` and `twitter:title` are always clean.

#### Bugs / surprises

- The regex needed a minimum 3-char site name guard (`{3,}`) to avoid stripping single- or two-char suffixes that might be part of a legitimate title rather than a site name. Edge case: if the regex strips the entire title, it falls back to the raw trimmed value.

---

### Achievements system

#### Decisions

- **Pure `check(stats)` functions in `achievements.js`:** Each achievement is a plain object with a `check` function — no side effects, no storage access. Makes them trivially testable and easy to extend.
- **`checkAchievements(stats, unlockedIds)` takes the unlocked set as a parameter:** Caller is responsible for storage. The achievements module stays pure.
- **Toast auto-dismisses after 3.5 seconds:** `clearTimeout` before each new toast prevents stacking if multiple achievements unlock at once.
- **Achievements panel overlays the popup as a positioned div:** Simpler than a fourth view in the view-switching system. Toggled via `hidden` class, no changes to view routing logic needed.
- **Locked achievements shown at 40% opacity with 🔒 icon:** User can see what's coming without it being distracting.
- **`speed_run` requires `sessionItemsCompleted >= 1`:** Guards against an empty session (user generates then immediately ends) unlocking the achievement.

---

---

## Post-Submission: Pre-publish Cleanup & Bug Fixes (2026-06-25)

With the class submission behind us, the goal shifted: get the extension to a state that can actually be published to the Chrome Web Store and Firefox Add-ons. That meant a code audit first, then fixes.

### Repo restructure

- Moved `ROADMAP.md` and `ARCHITECTURE.md` into `docs/` alongside the design doc
- Added branch workflow: all work now happens on feature/fix branches cut from `dev`, merged back after tests pass; `main` stays clean for releases only
- `CLAUDE.md` is gitignored — it's local tooling context, not project documentation

### Code audit findings

Reading through every source file with fresh eyes after the submission surfaced a few things that didn't matter for the class but would be wrong to ship publicly:

- **`dequeue_points` was a rogue localStorage key.** Every other piece of stored data goes through `storage.js` — `getItems`, `getSettings`, `getStreak`, `getUnlockedAchievements`, all of it. Points were the one exception: read/written directly in `popup.js` with a hardcoded key string, not in `KEYS`, and not cleaned up by `clearAll()`. The original reasoning in the log was that points are "UI-layer state" — which is fair, but the inconsistency was a maintenance hazard and a bug waiting to happen (`clearAll()` would leave stale points behind).
- **`markInProgress` and `clearInProgress` were inconsistent with every other write in `storage.js`.** Every other write function calls the private `setItems()` helper. Those two called `localStorage.setItem` directly. No behavior difference, but it was a trap for anyone reading the file and assuming the helper was always used.
- **`weight` and `timeEstimate` were duplicated on every saved item.** `handleAddSubmit` stored both with the same value: `timeEstimate` for the UI, `weight` for the knapsack. They were always in sync but the redundancy was going to cause confusion when porting the storage schema to other platforms. Removed `weight` from the saved item shape entirely — `scoreItems()` now derives it from `timeEstimate` before passing items to the knapsack. Single source of truth, no behavior change.
- **A debug `console.log` was still in the init block.** Fired on every popup open. Not a bug, just embarrassing to ship.
- **ESLint was missing most browser globals.** `setTimeout`, `clearTimeout`, `confirm`, `crypto`, `performance` were all flagged as undefined. They're all standard browser APIs — the config just never declared them. Added the full set.

### Files changed

- `src/utils/storage.js` — added `KEYS.POINTS`, `getPoints()`, `addPoints()`; fixed `markInProgress`/`clearInProgress` to use `setItems`; added `KEYS.POINTS` to `clearAll()`; `scoreItems()` now sets `weight` from `timeEstimate`
- `src/utils/scoring.js` — `scoreItems()` derives `weight: item.timeEstimate` so callers never need to set it manually
- `src/popup/popup.js` — imports `getPoints`/`addPoints` from `storage.js`; removed local points functions; removed `weight` from saved item; removed debug log; updated import list
- `eslint.config.js` — added missing browser globals

### P1 bugs fixed

**Item not marked "visited" when URL is opened.**
The session card's URL link (`cardUrl`) was a plain `<a>` tag. Clicking it opened the item in a new tab, closed the popup, and left the item completely unmarked — no `inProgress` flag, nothing. If the user read half the article and then closed the tab, re-opening the extension would show no sign that the item had been touched. The fix is a single line: `cardUrl.onclick = () => markInProgress(item.id)`, set each time `renderSessionCard()` draws a new item. The flag fires before the browser follows the link. Simple, and it's what `markInProgress` was always designed to do — it just wasn't wired here.

**Session not reliably restoring after popup close.**
The `chrome.storage.session` restore path existed and was correct, but `persistSession()` wasn't being called after a restore — only during generate and Done/Skip. If the popup closed and re-opened multiple times without advancing the session, the stored snapshot could drift from the in-memory state. Added `await persistSession()` immediately after reconstructing the `SessionQueue` from a saved session, so the snapshot is always fresh on open. Subtle race, easy fix.

### Still open

- Autofill title hit-or-miss: the extraction waterfall is correct, the likely failure point is the content script not injecting on restricted pages. Needs real failure cases logged before a fix is worth designing.

### Test count

157 tests, 7 files, all passing throughout. No regressions.

---

## Autofill Hint & Tier 1 Scoring Decisions (2026-07-02)

Picked up where the pre-publish cleanup left off: the one remaining P1 bug, then the Tier 1 engine-level design questions blocking multi-platform porting.

### Autofill hint (P1)

The root cause suspected in the previous session was confirmed: content scripts can't be injected into restricted pages (`chrome://`, `about:`, extension/store pages) or into tabs that were already open before the extension was installed or reloaded — a browser-level restriction, not something fixable from the manifest. `background.js` was already handling this correctly (returns `null` via the `chrome.runtime.lastError` branch), but the popup silently left the add-item form empty with no indication why. Added a neutral inline hint ("Couldn't read this page — enter details manually") that renders in that case, so manual entry doesn't read as a mystery failure. Deliberately styled as a neutral hint, not an error — this is expected behavior on those pages, not a mistake the user made.

### Tier 1 decisions resolved

All four open engine-level questions from `ROADMAP.md` got resolved in one pass, since they were blocking platform porting:

- **Recency/staleness weight asymmetry.** Confirmed the diagnosis from the design doc: under equal weights the two factors cancel out algebraically (`w×(1-f) + w×f = w`), so item age had zero effect on score regardless of weight magnitude. Changed `DEFAULT_WEIGHTS` to `recency: 0.1, staleness: 0.3` (was `0.2/0.2`) so staleness wins — old, forgotten items get surfaced instead of perpetually losing to new saves, matching the app's core anti-hoarding premise.
- **Mood, topic, staleness ceiling.** All three confirmed as-is (fixed mood presets, single topic tag, fixed 30-day ceiling) — the existing behavior was already the right call, they just needed to be documented as resolved rather than left as open questions.

### Interest rating redesign (not originally in ROADMAP, added mid-session)

A design concern came up that the required 1–5 star picker was itself a source of task-initiation friction — ADHD research (see `docs/proposal.md` references) specifically flags difficulty making calibrated judgment calls as a common symptom, and `interest` carries the heaviest scoring weight (0.5), so a rating the user avoided or picked arbitrarily under time pressure would undermine the whole score.

Replaced the 5-star picker with an optional 3-point scale (Low / Neutral / High) shown as two toggle buttons that nudge away from a neutral default rather than forcing a 5-way choice:

- Neither button pressed → stays at neutral (2), which is now a fully valid, zero-friction outcome
- Press Low or High → nudges to 1 or 3
- Press the active button again → returns to neutral
- No longer a required field to save an item

`computeScore` in `scoring.js` clamps interest into `[1,3]` and treats unset as neutral (2), so any stray out-of-range value degrades safely instead of skewing the score.

Verified the toggle behavior (default state, click-to-highlight, switch, toggle-off-to-neutral, save-without-touching) against the real `popup.html`/`popup.js` using a throwaway jsdom harness rather than a full Playwright setup, since there's no dev server for this popup-only extension — deleted after confirming all five scenarios passed.

### Files changed

- `src/utils/scoring.js` — `DEFAULT_WEIGHTS` (recency/staleness rebalanced), `computeScore` interest clamping/neutral-default
- `src/utils/scoring.test.js` — updated interest-factor test for the new 1–3 range, added clamp/neutral-default tests
- `src/popup/popup.html`, `popup.css`, `popup.js` — autofill hint element; star row replaced with the interest toggle; interest no longer required to submit
- `src/options/options.html` — updated static recency/staleness slider defaults to match the new weights
- `docs/ROADMAP.md` — two stale P1 items and four cleanup items corrected from ⏳ to ✅ (they were already fixed in the previous session but the doc hadn't caught up); Tier 1 section fully resolved
- `docs/design_documentation/DeQueue.md` — item schema, scoring section, and Decisions Log table synced to match

### Still open

- None from this pass — the ROADMAP.md P1 list and Tier 1 list are both fully resolved. Next up per ROADMAP.md: pre-publish hallway testing pass, then P2 features.

### Test count

159 tests, 7 files, all passing throughout. No regressions.
