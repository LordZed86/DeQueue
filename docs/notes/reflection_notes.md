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

### Why Vitest instead of Jest?

- The project already uses Vite. Vitest shares its config, handles ESM natively, and requires zero additional setup.
- Jest requires Babel or special transforms to handle ES modules. Extra complexity for no benefit here.

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
- "What would you add if you had more time?" — P1 features: sort/filter UI, mark-as-done + points counter. P2 stretch: auto-fetch from reading lists, calendar integration, topic clustering (graph theory).

### Demo preparation

- Have a working session generation ready to show: add 5–10 items manually, set a 20-minute budget, generate a session.
- Be ready to show the test suite running and passing.
- Be ready to open the DP table in the browser console and show what it looks like for a small input (could add a debug export for this).

---

_Add to this document as the project develops and new decisions are made._
