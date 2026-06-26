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

## What was done in the last session (2026-06-25)

- Moved `ROADMAP.md` and `ARCHITECTURE.md` into `docs/`
- Integrated both into `docs/design_documentation/DeQueue.md` (sections 11 + 12,
  updated open questions throughout)
- Fixed all four pre-release cleanup items:
  - `dequeue_points` now lives in `storage.js` (`KEYS.POINTS`, `getPoints`, `addPoints`, `clearAll`)
  - `markInProgress` / `clearInProgress` use `setItems` consistently
  - `weight` removed from saved item shape — derived in `scoreItems` from `timeEstimate`
  - Debug `console.log` removed from popup init
- Fixed two P1 bugs:
  - `cardUrl.onclick` now calls `markInProgress` before navigating away
  - `persistSession()` called after restoring a saved session on popup open
- Fixed ESLint config — added missing browser globals (`setTimeout`, `clearTimeout`,
  `confirm`, `crypto`, `performance`)
- All 157 tests still passing

## Immediate priorities

P1 bug still open:

- Autofill title hit-or-miss — likely content script not injected on restricted
  URLs; `background.js` silently returns null. Needs real failure cases to confirm
  root cause before fixing.

Next up (from `docs/ROADMAP.md`):

- Resolve Tier 1 open questions (recency/staleness default, mood presets, topic
  single vs. array, staleness ceiling) before starting any multi-platform work
- Pre-publish hallway testing pass
- Publish to Chrome Web Store and Firefox Add-ons

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

- **Branch workflow:** cut a `feature/<name>` or `fix/<name>` branch from `dev`
  for every piece of work. When tests pass, PR/merge back into `dev`. Never
  commit directly to `dev` or `main`. `main` = clean releases only.
- Fix/decide things once in the engine layer; record resolved decisions in
  `docs/ROADMAP.md` under "Resolved."
- When porting to Swift/Kotlin, port the tests too — including the brute-force
  oracle pattern.
- Native apps honor the design principles expressed idiomatically per platform;
  they don't have to visually match the extension popup.
- Do not reference this file or any AI tooling in committed files (docs, code,
  comments). If a principle needs citing, point to ROADMAP.md or ARCHITECTURE.md.
