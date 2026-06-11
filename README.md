# DeQueue

![Tests](https://github.com/LordZed86/CS_398_Final-Project/actions/workflows/test.yml/badge.svg)
![License](https://img.shields.io/badge/license-TBD-lightgrey)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow?logo=javascript)
![Manifest V3](https://img.shields.io/badge/WebExtensions-MV3-brightgreen?logo=googlechrome)
![Tests](https://img.shields.io/badge/tests-136%20passing-brightgreen)

A browser extension that helps people with ADHD manage content backlogs. You set a time budget, DeQueue uses a 0/1 knapsack algorithm to pick the highest-priority items that fit, and presents them one at a time so there's no choice paralysis.

Built for CS 398 — Algorithmic Problem Solving.

---

## What it does

- Save articles, videos, and links you want to get to
- Set a time budget (e.g. "I have 20 minutes")
- DeQueue selects the best items using a dynamic programming knapsack algorithm
- Items are presented one at a time — Done marks it complete, Skip cycles it to the back
- Priority scoring weighs interest rating, recency, staleness, and current mood

---

## Project structure

```plaintext
src/
├── manifest.json            # WebExtensions MV3 config
├── background/
│   └── background.js        # Service worker — relays messages between popup and content script
├── content/
│   └── content.js           # Injected into active tabs — scrapes page metadata to pre-fill the add form
├── popup/
│   ├── popup.html           # Extension popup UI (queue list, add item, session views)
│   ├── popup.js             # Popup logic — wires storage, scoring, knapsack, and queue together
│   └── popup.css
├── core/
│   ├── knapsack.js          # 0/1 knapsack DP — selects which items fit the time budget
│   └── queue.js             # SessionQueue — presents knapsack output one item at a time
└── utils/
    ├── scoring.js           # Priority score function (interest, recency, staleness, mood)
    └── storage.js           # localStorage wrapper — single place for all reads and writes
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

**Prerequisites:** Node.js 18+, Firefox or Chrome/Brave

**Install dependencies:**

```bash
npm install
```

**Build the extension:**

```bash
npm run build        # one-time build
npm run dev          # watch mode — rebuilds on every file save
```

After each build, go to `chrome://extensions` and click the refresh icon on the DeQueue card to reload it.

**Load in Firefox:**

1. Go to `about:debugging` → This Firefox → Load Temporary Add-on
2. Select `dist/manifest.json`

**Load in Chrome/Brave:**

1. Go to `chrome://extensions` → Enable Developer mode → Load unpacked
2. Select the `dist/` folder

**Run tests:**

```bash
npm test
```

**Watch mode (auto-rebuild on save):**

```bash
npm run dev
```

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

136 tests across 6 files, all passing.

| File                      | Tests | What it covers                                                                    |
| ------------------------- | ----- | --------------------------------------------------------------------------------- |
| `core/knapsack.test.js`   | 17    | DP vs. brute-force agreement, edge cases, known optimal solutions                 |
| `utils/scoring.test.js`   | 17    | Each scoring factor in isolation, output range, weight system, immutability       |
| `utils/storage.test.js`   | 29    | All CRUD operations, settings merge, corrupt-data resilience, clearAll scoping    |
| `core/queue.test.js`      | 23    | peek/dequeue/skip/toArray, skip cycling, buildSessionQueue sort order             |
| `content/content.test.js` | 37    | Metadata extraction (title, description, type, duration, topic), duration parsers |
| `core/pipeline.test.js`   | 13    | Full pipeline integration, stress tests at 50–100 items, performance              |

---

## Tech

- **Runtime:** Browser extension (WebExtensions MV3), Firefox + Chrome/Brave
- **Build:** Vite + vite-plugin-web-extension
- **Storage:** localStorage (item/settings data) + `chrome.storage.session` (active session state)
- **Tests:** Vitest, jsdom
- **Linting/formatting:** ESLint, Prettier
