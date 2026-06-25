# DeQueue — Architecture & Porting Strategy

This document captures the _reasoning_ behind technical decisions, not just the
decisions themselves. It's the expanded version of what's summarized in
`CLAUDE.md`. Update this as new platforms get built and assumptions get tested
against reality.

---

## 1. What's portable vs. what's platform-bound

DeQueue splits cleanly into two layers:

1. **The engine** — knapsack solver, scoring, session/queue management, the
   storage contract. Pure logic, no DOM, no browser APIs. This is genuinely
   portable: the same algorithm is correct whether it runs in a browser
   extension, an Electron app, or gets translated line-by-line into Swift.
2. **The capture mechanism** — how new items get _into_ the system. This is
   NOT portable, because it depends entirely on what the host platform gives
   you access to.

Everything else (UI, storage backend, capture UX) is platform-specific and
should be built idiomatically per platform rather than forced into a shared
abstraction.

---

## 2. The capture problem, per platform

### Extension (current, working)

Content script reads the **active tab's live DOM** directly. This is the
easiest possible version of capture — you already have a rendered page with
JS executed, paywalls resolved (if the user is logged in), everything. The
extraction waterfall (`og:*` → `twitter:*` → JSON-LD → DOM fallback → null)
works well because of this.

### Desktop (Win/Mac/Linux)

No "active tab" exists outside a browser. Options, in order of how seriously
they were considered:

- App fetches the URL itself and parses raw HTML — fails on JS-rendered SPAs
  and paywalled content that needs a real browser engine to resolve.
- Keep the extension installed alongside the desktop app; extension captures,
  syncs to desktop via local storage/file. Viable, but means desktop isn't
  fully standalone.
- **Likely answer:** revisit once mobile's capture strategy (below) is proven
  out, since the same hidden-webview approach should transfer to Electron/Tauri
  with minimal change.

This is intentionally **not fully decided yet** — see Roadmap.

### Mobile (iOS/Android) — decided direction

The primary capture path is the **OS share sheet**: user shares a URL from
Safari/Chrome/YouTube/any app directly into DeQueue. This is standard,
reliable, and well-documented on both platforms.

Once DeQueue has the bare URL, it still needs to turn it into usable metadata
(title, read time, content type, etc.) — the share sheet only gives you the
URL, not the parsed content. Two extraction strategies were considered:

| Approach                        | Pros                                            | Cons                                        |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Raw fetch + HTML parse          | Fast, cheap, no rendering overhead              | Fails on JS-heavy/SPA sites, paywalls       |
| Hidden webview render + extract | Robust — same capability as the extension today | Heavier (spins up a real renderer per item) |

**Decision: hybrid.** Try raw fetch + parse first (covers most server-rendered
blog/news content cheaply). If the result is empty or suspiciously short
(telltale sign of a JS-rendered shell), fall back to a hidden `WKWebView`
(iOS) / `WebView` (Android) render pass and extract from the live DOM —
conceptually the same as running Readability.js inside a sandboxed page load.
This mirrors what the extension's content script already does, just without
a real user-visible tab.

**Why not reimplement Readability natively in Swift/Kotlin?** The actual
parsing heuristics (find the main content block, strip nav/ads/boilerplate)
are exactly what Mozilla's Readability.js already solves well. The pragmatic
move is to run Readability.js _inside_ the hidden webview and pull the
resulting JSON out via the JS bridge, rather than porting that heuristic logic
natively twice.

### Video handling (all platforms)

**Never download video files.** DeQueue stores only URL + metadata (title,
duration, thumbnail), fetched via the platform's own API/oEmbed where
available (YouTube oEmbed, Vimeo, etc.). At playback time, either deep-link
out to the native YouTube/Vimeo app, or embed the official player (YouTube
iframe API wrapped in a webview, or a maintained wrapper library). This avoids
both a massive storage/bandwidth problem and ToS issues with re-hosting video.

PDF export (saving a clean article as a PDF) is a **secondary, optional**
feature — useful for offline reading after capture already succeeded — not a
capture mechanism in itself. Generating a good PDF from a live page is itself
a rendering problem (Safari Reader-equivalent), not a metadata-grab problem.

---

## 3. Why native-per-platform, not a shared mobile codebase

React Native / Flutter were considered and explicitly **not** chosen, despite
the appeal of reusing JS knowledge and the engine code almost verbatim.

Reasoning: the hard part of this app on mobile isn't the UI — it's OS-level
integration (share extensions, webview content extraction, possibly
background processing). Those integration points tend to have fewer rough
edges and better first-party documentation in native code than through a
cross-platform bridge. Given the project's riskiest technical surface is
exactly that integration layer, native-per-platform reduces risk where it
matters most, at the cost of writing (and learning) Swift and Kotlin
separately.

Practical sequencing for the languages:

- **Swift** is genuinely new syntax (optionals, protocols, SwiftUI's
  declarative model) — worth learning on its own merits, and Mac-based tooling
  means zero setup friction.
- **Kotlin** should feel closer to familiar territory given existing Java
  knowledge — JVM-based, direct Java interop, mostly feels like "Java with
  rough edges sanded off" (null-safety, data classes, lambdas).

Sequencing: **build iOS first**, prove the architecture (share extension →
hybrid parser → engine → session UI), then port the _proven design_ to
Kotlin/Android rather than designing and learning syntax simultaneously on
both platforms at once.

---

## 4. Engine porting approach

The engine (knapsack, scoring, queue, storage contract) gets:

1. Extracted into a standalone, browser-API-free module (no `chrome.*`
   references) so it can be validated independently of any host platform.
2. Translated faithfully into Swift and Kotlin when each native app is built
   — not reimplemented from memory or "vibes-checked" against the original.
3. Ported **with its tests**, including the brute-force oracle pattern
   (`knapsackBruteForce` checks the DP result against exhaustive search on
   small inputs) — this is cheap insurance against subtle translation bugs,
   which matters given the project has already found one non-obvious bug
   (recency/staleness cancellation — see ROADMAP.md).

Desktop's engine question (does it reuse the JS engine directly via
Electron/Tauri, or also get a native translation) is open — likely depends on
what UI framework gets picked for desktop, which is intentionally not decided
yet.

---

## 5. Theming

The CSS variable structure (`--color-bg`, `--color-accent`, etc.) used in the
extension is intentionally swappable — themes are just `:root` block swaps.
This was a deliberate, considered system, unlike the rest of the v1.x.x popup
markup.

Native apps won't reuse the CSS, but should reuse the **token structure and
the design philosophy**: pastel-on-dark, low visual noise, calm over
stimulating. Swift/Kotlin equivalents should define their own design-token
system (e.g. a `Theme` struct/object with the same semantic slots: background,
surface, surface-2, accent, accent-hover, text, text-muted, border, star-on)
so theme-swapping stays just as cheap natively as it is today via CSS.

---

## 6. Repo structure

See `CLAUDE.md` for the target monorepo layout. Single repo, not one repo per
platform — chosen specifically because the engine must stay in sync across
all surfaces, and a living roadmap/decision log is far more useful when it
lives next to the code it describes rather than in a disconnected docs repo.
