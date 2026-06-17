# DeQueue

![Tests](https://github.com/LordZed86/CS_398_Final-Project/actions/workflows/test.yml/badge.svg)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![Version](https://img.shields.io/badge/version-0.1.0-informational)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow?logo=javascript)
![Manifest V3](https://img.shields.io/badge/WebExtensions-MV3-brightgreen?logo=googlechrome)
![Tests](https://img.shields.io/badge/tests-157%20passing-brightgreen)

A browser extension that helps people with ADHD manage content backlogs. You set a time budget, DeQueue uses a 0/1 knapsack algorithm to pick the highest-priority items that fit, and presents them one at a time so there's no choice paralysis.

Built for CS 398 — Algorithmic Problem Solving.

---

## What it does

- Save articles, videos, and links you want to get to
- Set a time budget (e.g. "I have 20 minutes")
- DeQueue selects the best items using a dynamic programming knapsack algorithm
- Items are presented one at a time — Done marks it complete, Skip cycles it to the back
- Priority scoring weighs interest rating, recency, staleness, and current mood
- Streak tracking keeps a running count of your daily session completions
- Achievements unlock as you hit milestones and surface as toast notifications
- Options page lets you configure default time budget and scoring weights

---

## Planned features

### P2 — Near-term

- **JSON export / import** — back up your queue to a file and restore it on a new browser or after a reset
- **Topic clustering** — auto-group items by topic using a graph/similarity approach; this is where graph theory from the original design comes back in
- **Mood preset rework** — replace the free-text mood tag with a fixed set (e.g. "focus", "low-energy", "curious", "quick") for easier matching and better scoring
- **Scoring weight tuning** — expose the recency vs. staleness tradeoff as a user-facing bias slider so users can tune "prefer new saves ↔ clear old backlog"
- **Safari support** — WebExtensions API is largely compatible; needs testing and a possible manifest tweak
- **Article / video only mode** — filter sessions to one content type (e.g. no audio at work)
- **Long-form mode** — handle items over 60 minutes; useful for painting tutorials or long documentaries on a free afternoon

### P3 — Stretch

- **Auto-import** — pull saved items from Pocket, Instapaper, Readwise, or YouTube Watch Later
- **Auto-remove from source** — after marking an item done, optionally archive it in Pocket, Instapaper, or YouTube Watch Later so your external lists stay clean too
- **Calendar integration** — detect free time blocks in Google Calendar and pre-generate a session that fits the next gap
- **Item organization** — folder hierarchy or directory view for large queues
- **Algorithm visualizer** — watch the DP table fill in real time as a session generates; useful for demos and explaining the algorithm
- **User stats dashboard** — total items completed, minutes consumed, streaks, most-read topics; surfaces progress to counter the guilt from a growing backlog
- **Weight experimentation UI** — expose recency, staleness, and other scoring factors as tunable sliders so users can discover what weighting pattern actually matches how their brain prioritizes
- **Long-form library** — a separate space for items over 60 minutes (tutorials, documentaries, deep-dives) that sits outside the main knapsack; when you have a big block of free time, DeQueue surfaces what's waiting there so you don't have to make that call yourself

---

## Project structure

```plaintext
src/
├── manifest.json              # WebExtensions MV3 config
├── background/
│   └── background.js          # Service worker — relays messages between popup and content script
├── content/
│   ├── content.js             # Injected into active tabs — scrapes page metadata to pre-fill the add form
│   └── content.test.js
├── popup/
│   ├── popup.html             # Extension popup UI (queue list, add item, session views)
│   ├── popup.js               # Popup logic — wires storage, scoring, knapsack, and queue together
│   └── popup.css
├── options/
│   ├── options.html           # Settings page — default budget, scoring weights, default mood
│   ├── options.js
│   └── options.css
├── core/
│   ├── knapsack.js            # 0/1 knapsack DP — selects which items fit the time budget
│   ├── knapsack.test.js
│   ├── queue.js               # SessionQueue — presents knapsack output one item at a time
│   ├── queue.test.js
│   └── pipeline.test.js       # Full pipeline integration + stress tests
└── utils/
    ├── scoring.js             # Priority score function (interest, recency, staleness, mood)
    ├── scoring.test.js
    ├── storage.js             # localStorage wrapper — single place for all reads and writes
    ├── storage.test.js
    ├── achievements.js        # Achievement definitions and unlock logic
    └── achievements.test.js
```

---

## Algorithm

The session generator is a classic **0/1 knapsack** solved with bottom-up dynamic programming.

- **Capacity** = user's time budget in minutes (max 60)
- **Weight** = item's estimated time in whole minutes
- **Value** = priority score from `scoring.js`

The DP table is 2D (`dp[i][w]`) rather than the space-optimized 1D rolling array because backtracking to recover the selected set requires the full row history. With a 60-minute cap the table stays small, so memory is not a concern.

A brute-force exhaustive search (`knapsackBruteForce`) is exported alongside the DP solution and used in tests to verify correctness on small inputs.

---

## Running locally

> **Note:** This is a browser extension — it cannot run in Codespaces, StackBlitz, or any other cloud-based environment. It must be loaded into a local browser using developer mode.

**Prerequisites:** Node.js 18+, Chrome, Brave, or Firefox

**1. Install dependencies:**

```bash
npm install
```

**2. Build the extension:**

```bash
npm run build
```

This outputs the built extension to the `dist/` folder.

**3. Load the extension in your browser:**

**Chrome / Brave:**

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

**Firefox:**

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `dist/manifest.json`

**4. Use the extension:**

Click the DeQueue icon in your browser toolbar to open the popup. Navigate to any article or video, open the popup, and use **Add Item** to save it — the form will pre-fill from the page.

---

**Development (watch mode):**

```bash
npm run dev
```

Rebuilds automatically on every file save. After each rebuild, click the refresh icon on the DeQueue card in `chrome://extensions` to reload it in the browser.

**Run tests:**

```bash
npm test
```

**Test watch mode:**

```bash
npm run test:watch
```

---

## Tests

157 tests across 7 files, all passing.

| File                          | Tests | What it covers                                                                    |
| ----------------------------- | ----- | --------------------------------------------------------------------------------- |
| `core/knapsack.test.js`       | 17    | DP vs. brute-force agreement, edge cases, known optimal solutions                 |
| `utils/scoring.test.js`       | 17    | Each scoring factor in isolation, output range, weight system, immutability       |
| `utils/storage.test.js`       | 35    | All CRUD operations, settings merge, corrupt-data resilience, clearAll scoping    |
| `core/queue.test.js`          | 23    | peek/dequeue/skip/toArray, skip cycling, buildSessionQueue sort order             |
| `content/content.test.js`     | 42    | Metadata extraction (title, description, type, duration, topic), duration parsers |
| `core/pipeline.test.js`       | 13    | Full pipeline integration, stress tests at 50–100 items, performance              |
| `utils/achievements.test.js`  | 10    | Achievement unlock conditions, duplicate prevention, empty-stats base case        |

---

## Tech

- **Runtime:** Browser extension (WebExtensions MV3), Firefox + Chrome/Brave
- **Algorithm:** 0/1 knapsack via bottom-up dynamic programming (ES2022, no dependencies)
- **Build:** Vite + vite-plugin-web-extension
- **Storage:** `localStorage` (items, settings, streak, achievements) + `chrome.storage.session` (active session state)
- **Tests:** Vitest, jsdom
- **Linting / formatting:** ESLint, Prettier
