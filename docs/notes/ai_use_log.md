# DeQueue — AI Use Log

A record of how AI assistance was used during development, what it produced, and where human judgment was still required. Maintained for academic honesty and to support the CS 398 reflection paper.

---

## What I decided in the proposal and initial brainstorming

> **These decisions were all based in the memory file of the AI as hard decisions it was not allowed to deviate from if asked to assist in any implementation**

- ADHD "data hoarding" as the problem to solve (personal and family context)
- Knapsack as the algorithm (from course material — I made the connection before writing any code)
- Browser extension format (native tab integration, not copy-paste)
- No backend (privacy + simplicity)
- The specific scoring factors: interest, recency, staleness, mood match
- The `Item` data model shape
- All architectural decisions: client-side only, localStorage over IndexedDB, 2D DP table, one-at-a-time queue UX
- Which features belong in P0 vs. P1 vs. P2

---

## What AI was asked to do

| Task | AI's role |
| --- | --- |
| Core DP implementation | Filled gaps in DP knowledge; cleaned up and optimized my working implementation |
| Scoring function | Filled gaps in normalization math; I defined the factors and weights, AI helped structure the function cleanly |
| Test suite | Helped identify edge cases and scaffolded test structure; I caught errors in AI-generated assertions |
| Storage layer | Flagged safe defaults on corrupt data and jsdom test setup; I designed the schema and all function contracts |
| Session queue | Light assistance; I fully specified the behavior, AI filled in the class boilerplate |
| Extension scaffold & popup | Provided generic HTML/CSS/JS templates I worked from heavily; flagged MV3 messaging constraint |
| Background worker | Implemented to my spec; I was short on time and less familiar with MV3 — flagged the `return true` async requirement |
| Content script | Implemented to my spec; I was short on time and site metadata scraping across formats was complex |
| Session persistence | Recommended `chrome.storage.session` when I didn't know it existed; helped implement — introduced a missing `await` bug |
| Sort/filter UI | Provided UI templates I reworked; flagged division-by-zero on all-zero weights; I made all UX decisions |
| Options page | Helped implement weight sliders and normalization from my UX spec; I confirmed the math was right |
| Streak, achievements, site compatibility | Helped implement to my specs; flagged `{3,}` regex guard; I chose milestones and all behavioral reasoning |
| Documentation | Kept logs and docs structured after each session; I directed content, verified accuracy, wrote the hard parts |

---

## Per-feature breakdown

### Algorithm & Scoring

**What AI helped with:**

- Confirming 0/1 is the optimal knapsack variant
- Explaining the 1D vs. 2D DP table tradeoff, it wasnt helpful but it still attempted, it did confirm 2D was necessary for backtracking
- Assisted in adapting the core DP structure I had forked and altered — the main assistance was with zero-weight filter, and MAX_BUDGET cap
- Adjusted my scoring function structure and assisted with test scaffolding

**Where human judgment was required:**

- **Choosing the scoring factors:** Interest, recency, staleness, mood match came from thinking about what an ADHD user would actually have and care about. AI confirmed the normalization approach was valid but didn't choose the factors or code the burk of the function.
- **Max budget:** AI suggested 480 minutes when i didnt want to do some light research on ADHD attention spans. Overrode this immediately — the use case is gap-filling (waiting rooms, lunch breaks), not day-planning. 60 minutes is the honest cap.
- **2D vs. 1D:** AI tried to explain pros v cons. I made the call — 2D is more readable, explainable for a class context, and backtracking requires it anyway as far as i have been able to find in my research. the 2D array is also like I learned this algorithm in descrete structures.
- **Catching the recency/staleness cancellation:** A test asserted a fresh item scores higher than a 15-day-old item. It failed. AI had not flagged that under equal weights `0.2*(1-f) + 0.2*f = 0.2` always — the combined age contribution is constant. Changing 15 days to 29 days didn't fix it either. The correct fix (isolating each factor with custom weights) required understanding the math, not just trying different values.
- **Wrong expected value in the brute-force test:** Test expected `totalValue = 60`, real optimum was 65. DP was correct; the hand-computed test comment was wrong. Required manually tracing the example to catch it. This is a perfect use for AI and it failed lol glad I had time to hand trace this even though I hated doing every second of it.

---

### Storage Layer

**What AI helped with:**

- Flagged that `getItems()` should return safe defaults on corrupt data rather than throwing — I hadn't thought about storage corruption as a failure mode
- Suggested the `@vitest-environment jsdom` per-file docblock so only storage tests pay the jsdom startup cost; algorithm tests stay in fast Node mode
- Pointed out the `beforeEach(() => clearAll())` pattern to keep tests independent — obvious in hindsight but easy to miss

**Where human judgment was required:**

- **The schema and function list:** Two localStorage keys, which functions to expose, what each one does — all from the design doc before this session started
- **`setItems` stays private:** Callers should never bypass the read-modify-write cycle. I decided what the public API surface should be; AI filled it in.
- **`clearAll` scope:** Had to explicitly specify it removes only DeQueue keys, not call `localStorage.clear()`. That came from thinking about what else might share the extension's storage origin — not something AI flagged unprompted.
- **Test coverage:** Corrupt JSON recovery, no-op on missing ID, timestamp bracket for `markCompleted` — specified from the design doc's testing plan.

---

### Session Queue

**What AI helped with:**

- Filled in the class boilerplate once I had fully specified the contract
- Confirmed `peek()` returning null (vs. throwing) was the cleaner interface for the popup's "session done" check

**Where human judgment was required:**

- **The queue idea itself:** A deliberate nod to the app name — the user literally dequeues from DeQueue. That connection was mine.
- **`skip()` moves to back, not discard:** The user shouldn't lose an item just because they're not ready for it right now. That behavior came from thinking about how ADHD users actually work in a session, not from any AI suggestion.
- **Class-based over functional:** A class with internal state is cleaner for a mutable queue — caller doesn't have to pass the array back in on every call. My call.
- **All the behavior:** The entire contract — peek, dequeue, skip, toArray, buildSessionQueue sort order — was fully specified in the design doc before any code was touched. AI transcribed the spec.

---

### Extension Scaffold & Popup

**What AI helped with:**

- Provided generic starting templates for popup HTML/CSS/JS — three views, star rating pattern, basic event wiring
- Explained the MV3 constraint I hadn't hit yet: popups cannot message content scripts directly; background worker is the required relay
- Flagged that points should live outside `storage.js` as a UI-layer concern

**Where human judgment was required:**

- **Heavy rework of the UI:** The AI-generated templates were a starting point. The actual popup UI — layout, interactions, view switching, session card design — was built out from those templates through a lot of iteration.
- **Pipeline wiring:** The full `getPendingItems → scoreItems → knapsack → buildSessionQueue` chain was my design doc's data flow diagram. I verified it was wired correctly, not just that it ran.
- **`crypto.randomUUID()` context issue:** AI's first fix used `(globalThis.crypto ?? self.crypto).randomUUID()`. Flagged that `self` also isn't defined in the popup context — required knowing which Web APIs are available in which extension contexts.

---

### Background Service Worker

**What AI helped with:**

- Implemented the relay pattern based on my specification — I was short on time and the MV3 messaging architecture was new territory
- Flagged the `return true` requirement for async `sendResponse` — this is a non-obvious MV3 gotcha that causes completely silent failures and I would not have found it quickly on my own

**Where human judgment was required:**

- **Keeping the worker intentionally thin:** My constraint — the worker's only job is message relay, all storage stays in popup via `storage.js`. Had to push back on any drift toward putting more logic there.
- **Diagnosing the `return true` bug:** The "Add Item" form never pre-filled. Content script ran fine, popup received `undefined`. Only found the cause after reading MV3 messaging docs carefully — AI flagged the fix once I described the symptom, but finding the symptom required running the actual extension.
- **No unit tests:** Pure Chrome API wiring with no logic of its own. Testing it means mocking the APIs and asserting you called the mocks — that proves nothing. My call to leave it untested.

---

### Content Script

**What AI helped with:**

- Implemented the extractors and test suite based on my specification — I was running short on time and the metadata scraping logic across different site formats was getting complex
- Flagged the `typeof chrome !== "undefined"` guard so the module stays importable outside a real extension runtime
- Suggested the `innerText ?? textContent` fallback for jsdom — I wouldn't have thought about `innerText` being layout-dependent

**Where human judgment was required:**

- **Extraction priority order:** `og:*` → `twitter:*` → DOM fallback → null came from my design doc. Verifying AI implemented it correctly was my responsibility.
- **`window.location` is read-only in jsdom:** Three hostname tests failed. Rewrote them to use `og:type` meta tags — a judgment call about what the tests are actually verifying vs. what jsdom can simulate.
- **`??` vs. `||` operator precedence:** `document.title?.trim() ?? null` caused a rolldown parse error. Had to understand why to fix it correctly rather than guess.
- **`twitter:title` uses `property` not `name`:** Test used the wrong attribute — caught by the test failing. Easy to copy wrong from og: examples.

---

### Session Persistence

**What AI helped with:**

- Recommended `chrome.storage.session` when I described the problem — I didn't know this API existed and would have reached for localStorage. Explained the lifecycle tradeoff clearly.
- Helped implement save/load/clear and the popup init restore path

**Where human judgment was required:**

- **Identifying the bug:** Session reset was found during hallway testing. I described the behavior; AI diagnosed from the description. It didn't observe anything.
- **Missing `await` race condition:** The implementation didn't `await` the `saveSession` call. Popup closed before the async write finished — intermittent symptom depending on how fast I clicked. Had to understand fire-and-forget async in a short-lived process to diagnose it. AI caught it when asked to debug but introduced it in the first place.
- **Restore path skips `buildSessionQueue`:** Saved array is already in priority order. Re-running `buildSessionQueue` would re-sort it. That distinction was mine to catch.
- **Verifying it worked:** Loaded the extension in the browser, generated a session, clicked a link, reopened, confirmed it restored. AI can't do that.

---

### Sort/Filter UI, Options Page, In-Progress Flag

**What AI helped with:**

- Provided generic UI templates for the filter bar and options page that I worked from
- Flagged the division-by-zero case when all weight sliders are at 0 — edge case I hadn't considered
- Helped wire `markInProgress`/`clearInProgress` into storage once I defined the behavior

**Where human judgment was required:**

- **All the UX decisions:** Auto-normalization on save (users dial relative importance, not percentages), in-progress pins above sort rather than a separate section, mood filter and session mood as separate controls — all of these were design calls I made.
- **Heavy rework of UI templates:** Same as the popup — AI provided starting points, the actual filter bar and options page UI went through a lot of iteration.
- **Mood filter vs. session mood separation:** Decided not to link them. Different purposes (display filter vs. scoring input) — linking them would create surprising coupling that would confuse users.

---

### Streak, Achievements, Site Compatibility

**What AI helped with:**

- Helped implement streak logic, `cleanDocumentTitle`, and achievement unlock checking once the specs were defined
- Suggested the `{3,}` minimum length guard on the `cleanDocumentTitle` regex — I had the regex approach, AI caught that edge case
- Provided the toast and achievements panel UI templates I worked from

**Where human judgment was required:**

- **Which achievements and why:** First item, 5 items, 25 items, 3-day streak, 7-day streak, speed run — the milestones and the behavioral reasoning (early use, habit formation, focused sessions) were mine.
- **`cleanDocumentTitle` approach:** Recognized the problem from hallway testing — Wikipedia titles were cluttering the add form. Came up with the regex approach; AI helped refine the edge cases.
- **Streak in localStorage:** Streaks span days and survive restarts — had to specify this explicitly. AI would have used session storage without direction.
- **`speed_run` guard:** Flagged that an empty generate-then-end should not unlock the achievement. AI hadn't considered that edge case.

---

### Documentation

**What AI helped with:**

- Structured the dev log, design doc, and reflection notes after each session — I gave it the decisions and bugs, it organized them into the log format
- README rewrite, doc cleanup, and cross-referencing sections during this pre-release session

**Where human judgment was required:**

- **What was worth documenting:** Which decisions, bugs, and insights were interesting vs. routine. AI organized what I pointed at.
- **Accuracy:** Test counts, dates, decision rationale — all verified against the actual code and what actually happened. AI doesn't have ground truth on what went wrong.
- **Reflection prompts and defense prep:** The honest self-assessment questions in `reflection_notes.md` are mine. AI doesn't know what I understood vs. what I just executed and got lucky on.

---

## Honest assessment

### Where AI genuinely helped

- Filled in platform-specific knowledge I would have had to look up and might have gotten wrong: MV3 messaging rules, `chrome.storage.session` lifecycle, `return true` in async listeners
- Caught edge cases I hadn't thought of: safe defaults on corrupt storage, division-by-zero on all-zero weights, `{3,}` guard on the title regex
- Cleaned up and optimized code I had already written rather than replacing it
- Kept documentation organized and up to date so I didn't have to context-switch constantly

### Where AI fell short or made things worse

- Max budget suggestion of 480 minutes — completely missed the use case
- Recency/staleness cancellation — hadn't flagged the algebraic problem before the test failed; two fix attempts failed before the right approach
- Missing `await` on session save — introduced a subtle async bug that only showed up in manual testing
- Brute-force test expected value — wrong hand-computed answer in a generated test assertion; required tracing by hand to catch
- Generic HTML/CSS/.js for UI that was provided as a quick starting point was verbose and not optimal in my opinion. its even worse now that I added on to it just to get things ready for the project turn in. This added a lot of technical debt to the project that will need to get adjusted in the future.

### What was mine throughout

- The problem, the algorithm choice, the data model, the scoring factors
- The core code of 90% (est) of the project
- Every UX and architectural decision
- All the domain reasoning — why these features matter for ADHD users specifically
- Running the actual extension and finding bugs that only surface in the real environment
- Deciding what AI-generated code was right, wrong, or needed rework
