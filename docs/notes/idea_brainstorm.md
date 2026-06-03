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

## What We Built (P0 — Core)

### Algorithm (`src/core/knapsack.js`)

- 0/1 knapsack via bottom-up dynamic programming
- 2D table `dp[i][w]` — keeps full row history so we can backtrack and recover *which* items were selected, not just the best total value
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

---

## Ideas for Future Development

### P1 — Next priorities (core UX)

- **Queue view UI** — scrollable list of all pending items in the popup; sort by recency, interest, or staleness; filter by topic, mood, or content type
- **Add item form** — manual entry with fields for URL, title, time estimate, topic, interest rating, mood tag; pre-filled from page metadata when available
- **Session view** — show the knapsack output as a clean list with titles, time estimates, and links; subtotal the minutes used vs. budget
- **Mark as done** — checkbox or swipe on each item; triggers `markCompleted()` in storage; item disappears from future sessions
- **Points counter** — simple integer that increments on completion; displayed in the popup header
- **Manifest + popup wiring** — `manifest.json` to declare the extension, `popup.html/js/css` to tie everything together

### P2 — Enhancements (after core works)

- **Content script metadata scraping** — inject into the active tab to pull title, URL, `og:description`, estimated read time (word count ÷ 200 wpm), and content type (YouTube URL → video)
- **YouTube duration scraping** — read `.ytp-time-duration` from the player DOM to auto-fill time estimate for videos; fragile but useful
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
- Should scoring weights be user-configurable from the start, or hardcode defaults until P2?
- What's the right staleness ceiling — 30 days? 14? Should it be user-adjustable?
- Recency vs. staleness weight asymmetry — which direction should the default favor?
- Popup nav — persistent bottom nav bar, or one view at a time with a back button?
- Points counter — just a number, or some kind of visual reward on completion?
- YouTube scraper — worth maintaining given how often YouTube's DOM changes?
- Export/import format — plain JSON, or something compatible with Pocket/Instapaper?
