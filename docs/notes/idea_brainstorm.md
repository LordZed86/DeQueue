# DeQueue — Brainstorm & Ideas

---

## Original Idea (pre-development)

- People with ADHD often have a habit of "data hoarding" — keeping dozens of articles, videos, etc. they want to read or watch later; however, they often feel overwhelmed by the list and start to feel guilt for not going through the "hoard"
- This program would be a storage and organization system for these "data hoards" with which people could automatically save the articles and videos in one place. Further, the program would be able to sort the saves by time, topic, or mood and randomize or organize the lists in various ways to help the ADHD person with the struggle of prioritizing
- Some sort of ranked choice — maybe knapsack?
- Graph theory algorithms could come into play
- Immediately thought of a knapsack problem
- To encourage getting through the hoard, the program would gamify completing articles and videos with points, coins that can be spent on themes, skins, or designs
- Ideally local storage of some sort

---

## What is Built (P0 — Core)

### Algorithm (`src/core/knapsack.js`)

- 0/1 knapsack via bottom-up dynamic programming
- 2D table `dp[i][w]` — keeps full row history so we can backtrack and recover _which_ items were selected, not just the best total value
- Backtracking walks from `dp[n][budget]` upward: if a row's value changed, that item was included
- Budget capped at 60 minutes — matches the real use case (gap-filling, not day-planning)
- Items with weight 0 or over the cap are filtered before the table is built
- `knapsackBruteForce` exported alongside the DP version for test verification — checks all 2^n subsets, only practical for n ≤ 15
- Time complexity: O(n × W), effectively O(n) since W is fixed at 60
- Space complexity: O(n × W) for the 2D table

### Scoring (`src/utils/scoring.js`)

- Four factors, each normalized to [0, 1] before weighting so no single factor can dominate by scale:
  - **Interest** — user's 1–5 rating → `(rating - 1) / 4`
  - **Recency** — items added today score 1.0, decaying linearly to 0 at 30 days
  - **Staleness** — inverse of recency; items sitting the longest get a boost
  - **Mood match** — binary 1.0 bonus if the user's current mood matches the item's mood tag
- Final score is `round(weighted_sum × 100)` → integer in [0, 100]
- Weights live in `DEFAULT_WEIGHTS`; any caller can pass custom weights (used in tests, future options page)
- **Key insight discovered during testing:** recency and staleness cancel each other out under equal weights — the combined contribution is always constant regardless of age. The weights need to be asymmetric to actually differentiate items by age.
- `scoreItems()` maps over a list and attaches `.value` to each item, ready for direct input into `knapsack()`

### Storage (`src/utils/storage.js`)

- Thin wrapper around `localStorage` — nothing else in the app touches storage directly
- Two keys: `dequeue_items` (JSON array of Items) and `dequeue_settings` (JSON object)
- `getItems()` / `getSettings()` never throw — return safe defaults on missing or corrupt data
- `getPendingItems()` filters out completed items — this is the entry point for the knapsack
- `saveSettings()` merges into existing settings rather than overwriting, so callers only need to pass what changed
- `setItems()` is private (not exported) — raw write access is too dangerous to expose
- `clearAll()` removes only DeQueue keys, not all of localStorage
- Default budget: 20 minutes (reflects gap-filling use case)

### Session Queue (`src/core/queue.js`)

- `SessionQueue` class wraps the knapsack output array with proper queue behavior
- `peek()` — see the current item without consuming it
- `dequeue()` — mark done and advance to the next item
- `skip()` — move current item to the back of the queue; it stays available this session but isn't forced on the user right now
- `toArray()` — snapshot of remaining items for progress indicators ("1 of 4")
- `buildSessionQueue(selectedItems)` — entry point; sorts knapsack output by descending value so the highest-priority item is always first
- One-at-a-time presentation: reduces choice paralysis, which is the same problem the whole app addresses
- The naming pun: the user literally **dequeues** from **DeQueue**

### Testing (`knapsack.test.js`, `scoring.test.js`, `storage.test.js`, `queue.test.js`)

- 86 tests total, all passing
- DP verified against brute-force on multiple inputs
- Every edge case from the design doc covered: empty list, budget 0, all items over budget, exact fit, zero-weight filter, MAX_BUDGET cap
- Each scoring factor tested in isolation using custom weights
- Storage tests use jsdom environment (real `localStorage`, not a mock)
- `beforeEach(() => clearAll())` keeps storage tests independent

### Extension Shell (`manifest.json`, `vite.config.js`, `background.js`, `popup.html/js/css`)

- Manifest V3, targeting Firefox and Chrome/Brave
- Minimum permissions: `storage`, `activeTab`, `scripting`
- MV3 constraint discovered: popup cannot message content scripts directly — all cross-context messaging goes through the background service worker
- Background worker is intentionally thin — only responsibility is relaying `GET_PAGE_META` between popup and content script
- Popup has three views (queue list, add item, session) — only one visible at a time, back button nav
- Points stored separately from item data (UI concern, not data model)
- 10 pts per completed item; session complete screen shows session earnings

### Content Script (`content/content.js`, `content/content.test.js`)

- Scrapes active page on demand (triggered by popup "Add item" click)
- Extraction priority per field: `og:*` → `twitter:*` → DOM fallback → null
- Video duration: YouTube DOM (`.ytp-time-duration`) → `VideoObject` JSON-LD `PT4M32S` format
- Read time: `twitter:data1` (Medium) → `<article>` word count ÷ 200 wpm → `<main>` word count
- Every extractor returns null on failure — never blocks manual entry
- 37 new tests; jsdom limitation discovered: `window.location` is read-only, hostname-based detection tested via `og:type` instead
- 123 tests total across 5 files, all passing

---

## Ideas for Future Development

### P1 — Next priorities (core UX)

- ~~**Queue view UI**~~ ✓ shipped
- ~~**Add item form**~~ ✓ shipped — pre-filled from content script
- ~~**Session view**~~ ✓ shipped — one item at a time, Done/Skip, "N remaining", session complete screen
- ~~**Mark as done**~~ ✓ shipped
- ~~**Points counter**~~ ✓ shipped — 10 pts/item, header + session complete screen
- ~~**Manifest + popup wiring**~~ ✓ shipped
- ~~**Content script metadata scraping**~~ ✓ shipped
- **Sorting/filtering UI** — sort/filter controls are in the popup HTML but not wired up yet
- **Options page** — weight sliders, default budget, default mood picker
- **Extension icons** — 16, 48, 128px assets still missing

### P2 — Enhancements (after core works)

- **YouTube duration scraping** — implemented as best-effort; falls back to manual if YouTube's DOM changes
- **Options page** — weight sliders for the scoring function; default budget setting; default mood picker; data export/import
- **Expose scoring weights as user settings** — let power users tune interest vs. staleness vs. recency to match their own patterns
- **JSON export/import** — backup the queue as a file; restore on a new browser or after a reset
- **Topic clustering** — group items by topic tag, potentially using a graph/similarity approach for auto-tagging; this is where graph theory comes back in from the original brainstorm
- **Mood presets** — instead of a free text tag, offer a small fixed set: "focus", "low-energy", "curious", "quick" — easier to match and more useful in the scoring function
- **Safari support** — WebExtensions API is mostly compatible; would need testing and potentially a manifest tweak

### P3 — Stretch / long-term

- **Auto-import from Pocket / Instapaper / Readwise** — pull saved items from external reading lists via their APIs; removes manual entry entirely
- **Calendar integration** — detect free time blocks in Google Calendar and pre-generate a session that fits the next gap
- **Algorithm visualizer** — show the DP table filling in real time as the session is generated; great for the CS class demo and for explaining the algorithm
- **Full reward system** — points → coins → unlockable themes, icon skins, or popup backgrounds; gives the gamification layer a feedback loop
- **Auto-remove from source** — after marking done, optionally archive the item in Pocket/Instapaper/YouTube Watch Later
- **User stats dashboard** — total items completed, minutes consumed, streaks, most-read topics; surfaces progress to counter the guilt from the unread pile
- **Recency/staleness weight experimentation** — expose the weight imbalance discovered during testing as a user-facing "bias" slider: "prefer newer saves ←→ clear old backlog"

---

## Open Design Questions (still unresolved)

- Single topic tag vs. array of tags — array is more flexible but complicates filter UI
- Should scoring weights be user-configurable from the start, or hardcode defaults until options page?
- What's the right staleness ceiling — 30 days? 14? Should it be user-adjustable?
- Recency vs. staleness weight asymmetry — which direction should the default favor?
- YouTube scraper — worth maintaining given how often YouTube's DOM changes?
- Export/import format — plain JSON, or something compatible with Pocket/Instapaper?

## Resolved Design Questions

- ~~Popup nav — persistent bottom nav or back button?~~ → **Back button, one view at a time**
- ~~Points counter — just a number or visual reward?~~ → **Number only for P0** (header + session complete screen); visual feedback is P1/P2
- ~~localStorage vs. IndexedDB?~~ → **localStorage** for now; all access behind `storage.js` so migration is a single-file change
- ~~Max budget?~~ → **60 minutes** — gap-filling use case, not day-planning
- ~~1D vs. 2D DP table?~~ → **2D** — backtracking requires full row history
- ~~Skip behavior — discard or cycle?~~ → **Cycle to back** — item stays available this session
