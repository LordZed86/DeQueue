# DeQueue — Project Context for Claude Code

This file is local-only and not committed to the repo. It exists so Claude Code
doesn't have to re-derive project context every session.

See `docs/ROADMAP.md` for the living task/decision list and `docs/ARCHITECTURE.md`
for deeper technical reasoning. The primary design doc is
`docs/design_documentation/DeQueue.md`.

## What DeQueue is

DeQueue is a queue/session manager for the "data hoarding" problem — saving
articles and videos to read/watch later, then never getting through the pile.
It targets ADHD-pattern overwhelm specifically: the goal is to **remove choice
paralysis**, not just store links.

The core mechanic: tell it how much free time you have (e.g. "20 minutes
between meetings"), and it runs a 0/1 knapsack over your saved items
(weight = time estimate, value = priority score) to build a session that fits.
You work through one item at a time — Done advances, Skip cycles to the back.

This is a real, working product (currently a Manifest V3 browser extension,
v1.0.0, shipped). The immediate goal is to fix P1 bugs and pre-release cleanup
items so it can be published to the Chrome Web Store and Firefox Add-ons.
After that: multi-platform expansion (iOS → Android → Desktop).

## Current state

- **Extension (v1.0.0)** — shipped, on `main`. All active work happens on `dev`.
  Manifest V3, Chrome/Firefox/Brave target. Plain JS/HTML/CSS, no build step,
  no backend, no accounts. Storage: `localStorage` + `chrome.storage.session`.
- **Desktop / mobile** — planned, not started. See `docs/ARCHITECTURE.md`.

## Repo layout (current, as of this session)

```text
CS_398_Final-Project/
├── CLAUDE.md              ← this file (gitignored, local only)
├── src/                   ← the extension source
│   ├── manifest.json
│   ├── background/background.js
│   ├── content/content.js
│   ├── popup/             ← popup.html, popup.js, popup.css
│   ├── options/           ← options.html, options.js, options.css
│   ├── core/              ← knapsack.js, queue.js (+ tests)
│   ├── utils/             ← storage.js, scoring.js, achievements.js (+ tests)
│   └── assets/icons/
├── docs/
│   ├── ROADMAP.md         ← living task/decision log (P1, cleanup, Tier 1, P2, P3)
│   ├── ARCHITECTURE.md    ← porting strategy and reasoning
│   ├── design_documentation/DeQueue.md  ← primary design doc
│   └── notes/             ← brainstorm, dev log, ai use log, reflection
├── dist/                  ← built extension output (gitignored)
└── docs/proposal.md
```

The monorepo restructure (`packages/engine`, `apps/extension`, etc.) is a
future task in ROADMAP.md P2 — the repo is not yet organized that way.

## Immediate priorities (as of 2026-06-25)

**Before publishing to stores — fix these first:**

P1 bugs (user-visible):

1. Item not marked "visited" when URL is opened — `cardUrl` click doesn't call
   `markInProgress`; only End Session does. Fix: call `markInProgress` on link click.
2. Session resets when opening item in new tab — `saveSession` timing gap in
   `popup.js` init; needs targeted testing to find exact failure point.
3. Autofill title hit-or-miss — likely content script not injected on restricted
   URLs; `background.js` silently returns null.

Pre-release cleanup (not user-visible):

- `dequeue_points` bypasses `storage.js` — lives directly in `popup.js` localStorage calls
- Debug `console.log` still in `popup.js` init (line ~481)
- `weight` and `timeEstimate` duplicated on every saved item (both = timeEstimate)
- `markInProgress` in `storage.js` calls `localStorage.setItem` directly instead of `setItems`

## Core design principles (do not break these)

1. **One item at a time.** Single-item session view is the central anti-paralysis
   mechanism — don't turn it into a list picker without an explicit decision.
2. **No accounts, no backend, local-first.** Any server-touching feature must be
   strictly opt-in and additive.
3. **Calm UI, not stimulating UI.** Soft pastels on dark backgrounds, generous
   spacing, transitions under 150ms.
4. **Defensive extraction, never blocks manual entry.** Every extractor degrades
   to `null` on failure.
5. **The engine is the product.** The popup UI was built fast for a class deadline
   — replaceable. The knapsack/scoring/queue/storage logic is tested and
   intentional — port faithfully, don't reinvent casually.

## Engine summary

- **Knapsack** — 0/1, bottom-up DP, 2D table for backtracking, budget capped at
  60 min, `knapsackBruteForce` oracle for test verification (n ≤ 15).
- **Scoring** — four normalized [0,1] factors: interest, recency, staleness, mood
  match. Known issue: recency + staleness cancel under equal weights. Proposed
  fix: staleness wins (favor old items) — not yet confirmed, see ROADMAP Tier 1.
- **Queue** — `SessionQueue` FIFO, Done dequeues, Skip cycles to back.
- **Storage** — thin wrapper, never throws, returns safe defaults. `clearAll()`
  only touches DeQueue's own keys.

## Working agreements

- All work happens on `dev`. `main` = clean v1.0.0 release. Never commit directly
  to main.
- Fix/decide things once in the engine layer; record resolved decisions in
  `docs/ROADMAP.md` under "Resolved."
- When porting to Swift/Kotlin, port the tests too — including the brute-force
  oracle pattern.
- Native apps honor the design principles expressed idiomatically per platform;
  they don't have to visually match the extension popup.
- Do not reference this file or any AI tooling in committed files (docs, code,
  comments). If a principle needs citing, point to ROADMAP.md or ARCHITECTURE.md.
