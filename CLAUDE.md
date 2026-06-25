# DeQueue — Project Context for Claude Code

This file is auto-loaded by Claude Code at session start. It exists so you don't
have to re-explain project direction every session. See `ARCHITECTURE.md` for
deeper technical reasoning and `ROADMAP.md` for the living task/decision list.

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
v1.x.x, in active use), not a class exercise — though it started as one.
Treat correctness and the ADHD-focused design intent as load-bearing, not
optional polish.

## Current state

- **Extension (v1.x.x)** — the only shipped surface right now. Manifest V3,
  Chrome/Firefox/Brave target. Plain JS/HTML/CSS, no build step, no backend,
  no accounts. All storage is local (`localStorage` + `chrome.storage.session`).
- **Desktop (Win/Mac/Linux)** and **mobile (iOS/Android)** — planned, not yet
  started. See `ARCHITECTURE.md` for the porting strategy.

## Repo layout (target structure — monorepo)

```text
dequeue/
├── CLAUDE.md            (this file)
├── ARCHITECTURE.md
├── ROADMAP.md
├── packages/
│   └── engine/           ← knapsack, scoring, queue, storage contract
│       ├── src/
│       └── tests/
├── apps/
│   ├── extension/        ← current MV3 extension lives here
│   ├── desktop/          ← not started
│   ├── ios/               ← not started, Swift/SwiftUI
│   └── android/           ← not started, Kotlin/Compose
└── docs/
    └── decisions/         ← optional: one dated .md per resolved design question
```

If the repo isn't yet organized this way, that reorganization is itself a
near-term task — see ROADMAP.md P1.

## Core design principles (do not break these casually)

1. **One item at a time.** The queue surfaces a single item, not a list to
   choose from. This is the central anti-paralysis mechanism — don't "improve"
   it into a multi-item picker without an explicit product decision to do so.
2. **No accounts, no backend, local-first.** This has been true since the
   original brainstorm. Any feature that implies a server (sync, calendar
   integration, etc.) needs to be opt-in and additive, never a requirement to
   use the core app.
3. **Calm UI, not stimulating UI.** Soft pastels on dark backgrounds, generous
   spacing, short (<150ms) transitions. This applies to native app design too —
   the _principle_ travels even though CSS doesn't.
4. **Defensive extraction, never blocks manual entry.** Every metadata
   extractor (title, duration, read time, topic) must degrade to `null` on
   failure rather than throwing, so the user can always fall back to typing it
   in by hand.
5. **The engine (knapsack/scoring/queue/storage contract) is the product.**
   The popup UI in v1.x.x was built fast for a class deadline and carries no
   special weight — feel free to improve or replace it. The engine logic is
   tested and intentional — port it faithfully, don't reinvent it casually.

## Engine summary (see ARCHITECTURE.md for full detail)

- **Knapsack** — 0/1, bottom-up DP, 2D table for backtracking, budget capped
  at 60 minutes, brute-force oracle (`knapsackBruteForce`) exists for testing
  on small inputs (n ≤ 15).
- **Scoring** — four normalized [0,1] factors: interest (user 1–5 rating),
  recency, staleness, mood match. **Known issue:** recency and staleness
  cancel out under equal weights — see ROADMAP.md Tier 1 for the resolution.
- **Queue** — simple FIFO (`SessionQueue`), Done dequeues, Skip cycles to back.
- **Storage** — thin wrapper, never throws, returns safe defaults, `clearAll()`
  only touches DeQueue's own keys.

## Working agreements

- When fixing a bug or making a design decision, **fix/decide it once in the
  engine layer**, and record the decision in `ROADMAP.md` under "Resolved" —
  don't let extension/desktop/mobile drift into different behavior.
- When porting engine logic to Swift or Kotlin, port the **tests** too, not
  just the implementation. The brute-force oracle pattern is worth keeping.
- Native apps are NOT required to visually match the extension's current
  popup. They need to honor the design principles above, expressed idiomatically
  per platform (SwiftUI conventions, Jetpack Compose conventions, etc.).
- Long-form items (60+ min: documentaries, painting tutorials, deep-dives) are
  planned to live outside the knapsack entirely, in a separate "long-form
  library" — don't try to force them into the budget-constrained session.
