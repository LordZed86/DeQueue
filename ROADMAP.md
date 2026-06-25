# DeQueue — Roadmap & Decision Log

A living document. Add to this as decisions get made and priorities shift —
don't let new design questions get resolved three times across three
platforms when they could be resolved once, here.

Status key: ✅ Resolved · 🔄 In progress · ⏳ Open / not started

---

## P1 — Fix in the current extension (1.x.x) first

These are known issues from hallway testing. They affect real usage today and
should be fixed before P2/P3 feature work or platform porting begins.

- ⏳ **Autofill title hit-or-miss on some sites** — extraction waterfall
  (`og:title` → `twitter:title` → cleaned `document.title`) isn't catching
  everything. Needs a pass of real failure cases to identify what's slipping
  through.
- ⏳ **Session resets when opening an item in a new tab** — opening an item
  closes the popup, which currently loses session state. Needs the session to
  persist properly across that interaction (this is part of what
  `chrome.storage.session` was meant to solve — investigate why it isn't
  holding here).
- ⏳ **Mark item as "visited" on open, not just on Done** — so an interrupted
  session doesn't silently mark something complete that was never finished.
  Related to the existing in-progress flag/pin behavior — make sure they're
  actually connected.

---

## Tier 1 — Engine-level design questions (resolve once, applies everywhere)

These affect the engine layer (scoring, storage schema), so they need to be
decided before porting starts, not independently per platform.

- 🔄 **Recency vs. staleness weight asymmetry.**
  Under equal weights, recency (favors new items) and staleness (favors old
  items) cancel out completely — age stops mattering regardless of weight
  _magnitude_, only the _imbalance_ between the two matters.
  **Proposed default: staleness wins.** Rationale: the app's entire premise is
  fighting the "data hoarding" guilt pile — surfacing forgotten old items
  before they're abandoned. A recency-favoring default would mean new saves
  perpetually jump the queue while old ones rot forever, which is the exact
  failure mode the app is designed against.
  **Status: proposed, not yet confirmed.**

- ⏳ **Mood: fixed presets vs. free-text tag.**
  Brainstorm doc suggests a fixed set (focus, low-energy, curious, quick)
  would be easier to match against and better for scoring than free text.
  Not yet decided.

- ⏳ **Topic: single tag vs. array of tags.**
  Array is more flexible (an item can belong to multiple topics) but
  complicates filter UI. Not yet decided.

- ⏳ **Staleness ceiling: fixed 30 days vs. user-adjustable.**
  Current implementation decays staleness linearly to 0 at 30 days. Open
  question: does this need to be a setting, or is a fixed default fine
  (with the recency/staleness _weights_ being the adjustable knob instead)?

---

## P2 — Near-term features

Candidates for the next real release cycle, post-bug-fixes. Not yet
prioritized relative to each other.

- ⏳ JSON export / import — backup queue to a file, restore on a new
  browser/device or after a reset.
- ⏳ Topic clustering — group items by topic similarity (graph/similarity
  approach). This is where graph theory re-enters from the original
  brainstorm.
- ⏳ Article/video-only filter mode — useful in contexts where audio isn't an
  option (e.g. at work).
- ⏳ Long-form library — items over 60 minutes (documentaries, painting
  tutorials, deep-dives) live in a separate space outside the knapsack
  entirely. When the user has open-ended time, DeQueue surfaces what's
  waiting here instead of forcing it through budget-constrained scoring.
- ⏳ Safari support — WebExtensions API is mostly compatible; needs testing
  and a possible manifest tweak.
- ⏳ Monorepo restructure — reorganize the existing extension repo into the
  `packages/engine` + `apps/extension` layout described in
  `ARCHITECTURE.md`, ahead of starting the desktop/mobile builds.

---

## P3 — Stretch / platform-dependent

Bigger lifts, and some of these may end up platform-specific rather than
universal.

- ⏳ Auto-import from Pocket / Instapaper / Readwise / YouTube Watch Later —
  removes manual entry entirely.
- ⏳ Auto-remove from source — after marking an item done, optionally archive
  it in the external source list too.
- ⏳ Calendar integration — detect free-time blocks in Google Calendar and
  pre-generate a session that fits the next gap. (Note: this is the one
  feature so far that implies _some_ external account/API access — needs to
  stay strictly opt-in per the local-first principle in `CLAUDE.md`.)
- ⏳ Item organization — folder/directory structure for large queues.
- ⏳ Algorithm visualizer — show the DP table filling in real time as a
  session generates. Originally noted as "great for the CS class demo," but
  also a genuinely nice transparency feature for curious users.
- ⏳ User stats dashboard — total items completed, minutes consumed, streaks,
  most-read topics. Counters the guilt from the unread pile directly.
- ⏳ Weight experimentation UI — tunable sliders for all scoring factors,
  exposed beyond the current options page, so users can find the weighting
  pattern that matches their own prioritization style.

---

## Platform build order

1. **Extension (v1.x.x)** — shipped, ongoing maintenance + P1 bugs above.
2. **iOS** — build first among the new platforms. Learn Swift/SwiftUI in the
   process. Proves out: share-extension capture, hybrid HTML-parse/webview
   extraction, engine translation approach.
3. **Android** — port the _proven_ iOS architecture into Kotlin/Jetpack
   Compose, rather than designing and learning syntax on both platforms at
   once.
4. **Desktop (Win/Mac/Linux)** — capture strategy intentionally left open
   until mobile's hybrid approach is validated; likely reuses lessons (and
   possibly code, if Electron/Tauri-based) from the mobile builds.

---

## Resolved decisions (log)

Move items here once confirmed, with a one-line rationale, so future-you (or
Claude Code) doesn't have to re-derive _why_.

- ✅ **Porting philosophy:** the engine (knapsack/scoring/queue/storage) is
  ported faithfully and tested; the UI layer is rebuilt per-platform around
  shared _design principles_, not literal CSS — because the v1.x.x popup was
  built fast for a class deadline and carries no special weight, while the
  engine logic is correct, tested, and intentional.
- ✅ **No shared mobile codebase (no React Native / Flutter):** the riskiest
  technical surface is OS-level integration (share extensions, webview
  content extraction), which has better native support per platform than
  through a cross-platform bridge — so native-per-platform was chosen
  despite the extra learning curve.
- ✅ **Mobile capture mechanism:** OS share sheet as the primary capture path;
  hybrid raw-fetch-then-webview-fallback for turning the shared URL into
  usable metadata.
- ✅ **Video handling:** never store video files; URL + metadata only,
  platform oEmbed/API for metadata, official embedded player or deep-link for
  playback.
- ✅ **Repo structure:** single monorepo, not one repo per platform — keeps
  the engine in sync and the roadmap/decisions co-located with the code they
  describe.
- ✅ **Build order:** iOS before Android, both before desktop's capture
  strategy is finalized.
