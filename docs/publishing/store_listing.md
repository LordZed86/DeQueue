# Store Listing Copy

Shared listing text for both the Chrome Web Store and Firefox Add-ons (AMO)
dashboards. Paste directly into each store's listing form — no per-store
differences currently, since the underlying feature set and pitch are
identical. Update here first if the copy changes, then re-paste into both
dashboards so they don't drift apart.

---

## Short description

Chrome Web Store caps this at 132 characters; it's what shows under the
extension name in search results.

> Beat backlog paralysis: set a time budget, DeQueue picks your best
> articles/videos to fit it, and hands them to you one at a time.

(131 characters)

---

## Detailed description

DeQueue helps you actually get through the articles, videos, and links you
keep saving "for later."

Instead of scrolling an endless list and stalling out trying to pick what to
read next, you tell DeQueue how much time you have — say, 20 minutes — and
it builds a session for you. Under the hood, it's solving a 0/1 knapsack
problem: given your time budget and each item's estimated length, it finds
the set of items that fits best, weighted by how interesting, recent, or
overdue they are.

Items are then presented one at a time. Mark one done, or skip it to the
back of the queue — no need to re-decide your whole list every time.

**WHY DEQUEUE**

Saved-item piles cause real anxiety for a lot of people, ADHD or not — the
list just grows, nothing ever feels like "the right time," and eventually
it's easier to ignore the whole thing than face it. DeQueue is built around
removing the decision-making step that causes that freeze: you don't pick
what to read, you pick how much time you have, and DeQueue does the
picking.

**FEATURES**

- Save articles, videos, and links — auto-fills title, type, and estimated
  time from the page you're on
- Set a time budget and get a session built for you automatically
- Simple Done / Skip flow — no re-sorting your whole backlog every session
- Optional Low/Neutral/High interest rating (skip it — items default to
  neutral, no forced 5-star ratings)
- Session-time mood picker biases toward shorter or higher-interest items
  depending on how you're feeling, without asking you to predict your
  future mood in advance
- Streaks and achievements to mark progress
- Fully configurable scoring weights if you want to tune how DeQueue
  prioritizes

**PRIVACY**

DeQueue runs entirely on your device. Nothing is sent to a server, there's
no account, and no data is shared with anyone — see the full privacy policy
for details. Page metadata is only read from the tab you're actively
viewing when you open the popup, not collected in the background.

**OPEN SOURCE**

DeQueue is open source. Source code, issue tracker, and full documentation:
https://github.com/LordZed86/DeQueue

---

## Single-purpose statement (Chrome only)

> Save articles and videos, then build a time-boxed session from them via
> knapsack prioritization.

## Permission justifications (Chrome only)

- **storage** — persist saved items, settings, and points locally.
- **activeTab** — read metadata (title/description/type/duration/topic)
  from the tab the user is actively adding, only when they invoke the
  extension.
- **scripting** — inject the metadata-extraction function into the active
  tab on demand, rather than requesting standing access to every page.

## Category

Suggested: **Productivity**.
