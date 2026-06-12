# DeQueue — Reflection & Defense Notes

Running list of things worth thinking about for the final reflection paper and project defense. Add to this as the project develops.

---

## Algorithm — things to be able to explain

### The knapsack problem itself

- **What problem does it solve?** Given a set of items each with a weight and a value, select a subset that maximizes total value without exceeding a capacity limit.
- **Why 0/1?** Each item can only be selected once (you either read the article or you don't). The fractional variant (where you can take a portion of an item) doesn't apply here.
- **Why bottom-up DP?** Top-down (memoized recursion) would also work, but bottom-up avoids recursion overhead and the table is easy to inspect. Also: bottom-up is the version covered in CS 398.
- **What does the DP table represent?** `dp[i][w]` = the maximum priority score achievable using the first `i` items with a time budget of `w` minutes.
- **How does backtracking work?** After filling the table, you start at `dp[n][budget]` and walk backward through the rows. If `dp[i][w] != dp[i-1][w]`, item `i` was included — subtract its weight and continue up.
- **Time complexity:** O(n × W) where n = number of items and W = budget in minutes. With W capped at 60, this is effectively O(n).
- **Space complexity:** O(n × W) for the 2D table. Could be reduced to O(W) with the 1D rolling array, but we kept 2D for backtracking.

### The scoring function

- **Why not just sort by interest rating?** Sorting ignores time constraints — a 5-star 45-minute article may be worse than a 4-star 10-minute article when you only have 15 minutes. The knapsack considers all factors simultaneously.
- **What are the four factors?** Interest (user-assigned), recency (how new the item is), staleness (how long it's been sitting), mood match (does this fit the user's current energy level).
- **Why do recency and staleness both exist?** They're opposites. Recency pulls toward new saves; staleness pulls toward old ones that have been ignored. Together they prevent the queue from being dominated by either extreme. Under equal weights, they cancel — this is a tuning question.
- **Why normalize to [0, 100]?** Keeps the DP values human-readable, avoids floating-point noise in the table, and makes it easy to display scores in the UI if needed.

---

## Design decisions to be ready to justify

### Why a browser extension?

- Native integration: we can inject a content script to read the current page's title, URL, estimated reading time, and topic — no copy-paste needed.
- Vs. a web app: a web app can't access the current tab's DOM without user action. The extension makes "save this page" a one-click experience.

### Why no backend?

- Privacy: all data stays on the user's machine. No account, no server, no data leaving the browser.
- Simplicity: no API to maintain, no database to host, no auth to build.
- Appropriate for the scope: this is a personal tool, not a service.

### Why 60 minutes as the max budget?

- The use case is filling _gaps_ — waiting rooms, lunch breaks, the 20 minutes between tasks. This is not a tool for planning a full-day reading session.
- A 60-minute cap keeps the DP table small and the UX honest about what the tool is for.

### Why start with localStorage instead of IndexedDB?

- localStorage is synchronous and dead simple — read a string, parse JSON, done.
- IndexedDB is async, requires understanding of transactions and object stores, and is much more code.
- For a list of dozens of items, localStorage is plenty. Migration to IndexedDB is the right move if the list grows large or we need indexed queries, but we're not there yet.

### Why add a queue on top of the knapsack output?

- The knapsack returns a flat array — the queue gives that array behavior: a current item, a way to advance, a way to skip without losing the item.
- It also directly ties the data structure to the app's name. The user literally dequeues from DeQueue.
- One-at-a-time presentation is more ADHD-friendly than showing a full list and asking "which one?" — that's the same choice paralysis the app is trying to solve.
- `skip()` moves to the back rather than discarding because the user may want that item later in the same session, just not right now.

### Why does `buildSessionQueue` sort by descending value?

- The knapsack optimizes for total value across the whole session but returns items in whatever order it happened to pick them.
- Sorting by descending value ensures the highest-priority item surfaces first, when the user's attention is freshest.
- This is a deliberate UX decision: the algorithm handles _which_ items to include; the sort handles _what order_ to present them.

### Why start with localStorage instead of IndexedDB?

- localStorage is synchronous and dead simple — read a string, parse JSON, done.
- IndexedDB is async, requires understanding of transactions and object stores, and is much more code.
- For a list of dozens of items, localStorage is plenty. Migration to IndexedDB is the right move if the list grows large or we need indexed queries, but we're not there yet.
- All access goes through `storage.js` — nothing else touches localStorage directly — so migrating later is a single-file change.

### Why does `saveSettings` merge instead of overwrite?

- The options page will let users change one setting at a time (e.g. update the default budget without touching their saved mood preference).
- If `saveSettings` overwrote the whole object, every caller would need to read all settings first, modify the one field, then write everything back. The merge approach lets callers just pass the field they're changing.

### Why is `setItems` not exported?

- It's a raw write — it replaces the entire list with whatever you pass. Exposing it would let any caller silently wipe the queue if they forgot to read first.
- `saveItem`, `updateItem`, `deleteItem`, and `markCompleted` all do the read-modify-write cycle correctly. There's no safe reason for a caller to bypass them.

### Why use `chrome.storage.session` for active session state instead of localStorage?

- Session state has a different lifetime than item data. Items should survive browser restarts — that's why the user saved them. Session state should not. A session is "I have 20 minutes right now" — not something to restore days later.
- `chrome.storage.session` matches that lifecycle exactly: it survives popup close and tab switches within a session, but auto-clears on browser restart.
- localStorage would require manual cleanup and would fail silently on crash — the user would reopen the extension and see a phantom session from a week ago.

### Why use `chrome.storage.session` for active session state instead of localStorage?

- `localStorage.clear()` would wipe everything stored at the extension's origin, including any data that other extension components might store in the future.
- Scoping the removal to `dequeue_items` and `dequeue_settings` is safer and less surprising.

### Why Vitest instead of Jest?

- The project already uses Vite. Vitest shares its config, handles ESM natively, and requires zero additional setup.
- Jest requires Babel or special transforms to handle ES modules. Extra complexity for no benefit here.

### Why does the storage test file use `@vitest-environment jsdom` instead of a mock?

- `localStorage` is a browser API — Node (where Vitest runs by default) doesn't have it.
- jsdom is a headless DOM implementation that provides a real `localStorage`. Using it means the tests exercise the actual API rather than a mock that might behave differently.
- The docblock is per-file, so only `storage.test.js` pays the jsdom startup cost. The algorithm and scoring tests continue running in fast Node mode.

### Why does the popup route `GET_PAGE_META` through the background worker instead of messaging the content script directly?

- Manifest V3 removed the ability for popups to message content scripts directly. In MV3, cross-context messaging must go through the background service worker.
- This is an architectural constraint of the platform, not a design choice. The background worker is the required intermediary.
- The key implementation detail: the `onMessage` listener must `return true` when calling `sendResponse` asynchronously. Without it, the message channel closes before the response arrives — a silent failure that's very hard to debug.

### Why are `background.js` and `popup.js` not unit tested?

- `background.js` is pure Chrome API wiring with no logic. Testing it means mocking `chrome.tabs.query` and asserting you called the mock — that's testing that you wrote the code you wrote, not that it's correct. Real bugs only surface in a running extension.
- `popup.js` is DOM manipulation glue over modules that are already thoroughly tested. The value of a unit test here is low; the maintenance cost (tests break on every HTML change) is high. Meaningful coverage requires either browser automation or a component framework with stable test seams.
- Both are covered by the planned integration/hallway tests.

### Why does `content.js` guard the `chrome.runtime` listener?

- Without the guard (`if (typeof chrome !== "undefined" && chrome.runtime?.onMessage)`), importing the module in Node/jsdom throws immediately — `chrome` doesn't exist outside a browser extension context.
- Guarding it makes the module safely importable in tests. The listener only runs when a real extension runtime is present.
- This is the same pattern used in any isomorphic code that needs to behave differently in server vs. browser environments.

### Why export the content script's extractor functions?

- The message listener is just an entry point — it calls `extractPageMeta()`, which calls individual extractors. The logic is in those functions.
- Exporting them allows unit testing each extractor in isolation: set up a specific DOM state, call the function, assert the result. Without exports, the only way to test would be to simulate the full message passing flow.
- It also makes the extraction logic reusable if we ever add an options page that wants to preview what would be scraped from the current page.

---

## Honest reflection prompts

These are questions worth answering honestly in the reflection paper.

### About the algorithm

- Did you understand the DP table _before_ you wrote the code, or after? Be honest.
- Could you implement the knapsack from scratch without help? What would you need to look up?
- The backtracking step — can you explain why checking `dp[i][w] != dp[i-1][w]` tells us the item was included?
- What would happen if two items had the exact same weight AND value? Does the algorithm handle ties deterministically?

### About AI use

- Where did AI help the most? Where did it slow you down?
- The test failure revealed that recency and staleness cancel each other out under equal weights — did the AI notice this before the test ran, or only after? What does that say about AI-generated tests vs. hand-written ones?
- Were there any moments where AI confidently generated something wrong? How did you catch it?
- If you had to redo this project without AI, which parts would have taken the longest?
- Did using AI change how you thought about the problem, or just how fast you executed?

### About the project domain

- Why does the knapsack metaphor work for ADHD content management specifically?
- The scoring function has a "mood" factor. How did you decide which moods to support? Is this evidence-based or intuitive?
- "Staleness" as a factor — did this come from research on ADHD hoarding behavior, or was it a design assumption? What would you need to validate it?
- Is the gamification layer (points, completion tracking) evidence-based? What does the ADHD research say about reward systems?

### About the storage layer

- The storage module has no algorithm — it's pure plumbing. Did you find it easier or harder to reason about than the knapsack? Why?
- `getItems()` silently returns `[]` on corrupt JSON rather than throwing. Is that the right call? What would a user experience if storage corruption went undetected?
- The test for `markCompleted`'s default timestamp uses a before/after bracket rather than mocking `Date.now`. What's the tradeoff between the two approaches?
- If the queue grew to 500 items, localStorage would start to feel it (~5MB cap). What would the migration to IndexedDB actually look like? What would have to change outside of `storage.js`?

### About the content script

- The content script has to work on any page — a news article, a YouTube video, a Reddit thread. How did you decide which metadata sources to try, and in what order?
- The word count ÷ 200 wpm estimate is rough. What would you need to know about a page to do better? Is it worth it?
- `innerText` isn't available in jsdom, so the tests use `textContent` as a fallback. In a real browser these behave differently — `innerText` respects CSS visibility, `textContent` doesn't. Does that matter for DeQueue's use case?
- The hostname-based content type detection (youtube.com → video) can't be tested in jsdom because `window.location` is read-only. How would you test it if you needed to? Is "correct by inspection" a defensible position?

### About MV3 and the background worker

- MV3 blocks direct popup → content script messaging. Did you know this before you hit it, or did it surface as a bug? What does that say about how well you understand the platform you're building on?
- `return true` in the `onMessage` listener is a well-known MV3 gotcha. How did you catch it? Would a test have caught it?

### About what you'd do differently

- Would you keep the 2D DP table, or switch to 1D now that you understand it better?
- The recency/staleness symmetry was a design bug that tests surfaced. Would you have caught it in a code review? What does that say about the value of testing?
- Anything in the design doc that you now think was wrong or needs revisiting?

---

## Things to prepare for the defense

### Questions the instructor might ask

- "Walk me through the DP table for a small example." — Be ready to trace through a 3-item, 10-minute-budget example on paper.
- "Why is this a 0/1 knapsack and not a fractional or bounded knapsack?" — 0/1 because each item is either read or not; no partial consumption.
- "What's the time complexity? Space complexity?" — O(n×W) time, O(n×W) space. With W=60, effectively linear in n.
- "How does the scoring function prevent a single factor from dominating?" — Normalization to [0,1] before weighting. All factors on the same scale.
- "How did you verify correctness?" — Brute-force comparison on small inputs (≤15 items, all 2^n subsets), plus hand-verified known cases, plus edge case tests.
- "Why did you choose these specific scoring factors?" — Design decision based on what signals an ADHD user would actually have access to and care about: their own interest rating, how fresh the content is, how long it's been waiting, and how it matches their current energy.
- "What would you add if you had more time?" — P1 features: sort/filter UI, options page (weight sliders, default budget). P2 stretch: auto-fetch from reading lists, calendar integration, topic clustering (graph theory).
- "Why did you add a queue if the knapsack already gives you a list?" — The knapsack answers _which_ items to include. The queue answers _how to present them_ — one at a time, in priority order, with a skip-without-losing mechanic. They solve different problems. The queue is also a direct nod to the app name.
- "Why localStorage and not IndexedDB?" — localStorage is synchronous, requires no async handling, and is simple to debug. For a personal tool with a modest item count, it's plenty. All access is behind `storage.js`, so migrating later is a single-file change with no impact on the rest of the app.
- "What happens if `localStorage` is full or unavailable?" — `getItems()` and `getSettings()` catch exceptions and return safe defaults. `saveItem` would throw silently in its current form — that's a known gap that could be addressed with a try/catch and a user-facing error message.

### New defense questions from today's work

- "Why does the popup have to go through the background worker to talk to the content script?" — MV3 architectural constraint. The popup context and content script context are isolated; the service worker is the only allowed bridge.
- "How does the content script know what kind of page it's on?" — Hostname regex for known video sites (YouTube, Vimeo), then `og:type` meta tag. Falls back to "article" as a safe default.
- "How does the content script estimate reading time?" — Two strategies: `twitter:data1` meta (used by Medium), and word count of the `<article>` element divided by ~200 wpm. Both are pre-filled and editable before saving.
- "Why aren't `background.js` and `popup.js` unit tested?" — See the testing rationale in `reflection_notes.md` and `dev_log.md`. The short answer: no logic to test in background.js; DOM glue over tested modules in popup.js.
- "Your content script tests use `og:type` to trigger the video path but your code also checks the hostname. How do you know the hostname branch is correct?" — Correct by inspection: it's three lines of regex with no branching. The `og:type` tests cover the same downstream behavior.

### Defense questions from session persistence work

- "Why didn't you just use localStorage for the session state too?" — localStorage persists until explicitly cleared. If the browser crashed mid-session, the stale session would incorrectly restore the next time the user opened the extension. `chrome.storage.session` is automatically scoped to the browser session and self-cleans at the right time — no manual lifecycle management needed.
- "Why does the popup close when the user clicks a link?" — The extension popup is a browser window, not a persistent process. Any navigation event (opening a tab, clicking a link) closes it. This is a fundamental WebExtensions constraint, not a bug.
- "Why didn't the first implementation work even though the design was correct?" — The `saveSession` call wasn't awaited inside `generateSession`. `chrome.storage.session` is async — calling it without `await` starts the write but doesn't wait for it to finish. The popup can close before the write completes, leaving nothing in storage to restore. The fix was making the function async and awaiting the write before the popup could close.
- "How does the restore path know which item to show first?" — It reconstructs a `SessionQueue` directly from the saved item array, which is already in priority order from when the session was first generated. It doesn't re-run `buildSessionQueue` (which would re-sort) — it trusts the saved order.

### Defense questions from sort/filter + options work (2026-06-11)

- "How does the sort-by-priority work — is it just the knapsack order?" — No. The filter/sort runs `scoreItems()` on the visible subset fresh each time, using the current mood selection. The queue view and session generation now use the same scoring signal. Sort by interest/recency/time use raw item fields.
- "Why do you have both a mood filter in the queue view AND a mood selector for session generation?" — They do different things. The session mood selector feeds into `scoreItems()` and affects which items the knapsack picks. The queue mood filter just narrows what's displayed — it doesn't affect session generation. A user might filter to see only "focus" items, then generate a session from that subset.
- "How does the in-progress flag work if the user closes the browser entirely?" — `inProgress` is stored in localStorage, which persists across browser restarts. The flag survives. `chrome.storage.session` (active session state) would be cleared, but the item-level flag is independent of the session object.
- "Why auto-normalize the weights in the options page instead of requiring the user to keep them at 100%?" — Because users shouldn't have to do math to tune their preferences. Asking "is interest more important than recency to you?" is a natural question; asking "set these four values to sum to exactly 1.0" is a UX failure. The normalization happens at save time transparently.
- "What happens if all four weight sliders are at 0?" — The sum is 0, so the division would produce NaN. The code guards against this with `const sum = rawSum || 1`, treating all-zero as the same as all-equal. Every item scores the same in that degenerate case, which is acceptable.
- "Why does the topic dropdown repopulate on every render instead of caching it?" — The item list can change (add, delete) between renders. Repopulating from the current item set is the simplest way to stay accurate. It's a small array — the overhead is negligible.

### Demo preparation

- Have a working session generation ready to show: add 5–10 items with varied topics and moods, set a 20-minute budget, generate a session.
- Demo the filter bar: filter by topic, watch count update; sort by interest, watch order change.
- Demo the in-progress flag: start a session, click End Session mid-way, show the item pinned with the badge in the queue.
- Open the options page via the gear button; adjust a weight slider, save, regenerate a session to show the ordering changed.
- Be ready to show the test suite running and passing (136 tests, 6 files).
- Be ready to open the DP table in the browser console and show what it looks like for a small input (could add a debug export for this).
- Load the unpacked extension in Chrome or Firefox and demonstrate the add-item flow with metadata pre-fill on a real page.

---

_Add to this document as the project develops and new decisions are made._
