# DeQueue Privacy Policy

**Last updated: 2026-07-08**

DeQueue is a browser extension that helps you manage a backlog of articles,
videos, and links using a time-budgeted priority queue. This policy explains
what data the extension touches and what happens to it.

## Short version

Everything DeQueue does stays on your device. There is no account, no
server, no analytics, and nothing is ever transmitted anywhere.

## What DeQueue reads

When you open the extension popup on a tab, DeQueue reads public page
metadata from that tab only — the page's URL, title, description, content
type (article vs. video), an estimated read/watch time, and a topic hint.
This comes from standard page metadata (Open Graph tags, Twitter Card tags,
JSON-LD, visible DOM content) and is used only to pre-fill the "add item"
form so you don't have to type it in by hand. Nothing is read from any tab
you haven't actively opened the popup on, and nothing is read in the
background — the extension only requests access to the page you're
currently viewing, at the moment you invoke it (`activeTab` permission),
rather than persistent access to every page you visit.

## What DeQueue stores

Everything you save or configure is stored locally in your browser, using
the browser's built-in WebExtension storage APIs (`localStorage` and the
extension `storage` API's session area) — the same mechanism any website
uses to remember your preferences. This is a cross-browser standard: it
works identically in Chrome, Firefox, and other browsers that support the
WebExtensions platform, and none of it is specific to one browser vendor.
This includes:

- **Saved items** — URL, title, time estimate, content type, topic, your
  optional interest rating, and timestamps (when added, when completed).
- **Settings** — your scoring weight preferences, default time budget, and
  default mood.
- **Progress data** — achievement unlocks, streaks, and points.
- **Active session** — the current queue of items during a session, cleared
  automatically when the browser closes.

None of this data leaves your device. It is not sent to any server (DeQueue
doesn't have one), not shared with any third party, and not used for
advertising, tracking, or analytics of any kind.

## Uninstalling

Removing the extension deletes all locally stored DeQueue data along with
it, the same way uninstalling any extension clears its local storage.

## Permissions

DeQueue requests three browser permissions, each used only for what's
described below:

- `storage` — save your items, settings, and progress locally.
- `activeTab` — read metadata from the tab you're actively viewing, only
  when you open the popup.
- `scripting` — inject the metadata-reading code into the active tab on
  demand (see "What DeQueue reads" above); this replaces requesting
  standing access to every page you visit.

## Changes to this policy

If what DeQueue collects or how it's stored ever changes, this document
will be updated and the "Last updated" date above will reflect it.

## Contact

Questions about this policy or how DeQueue handles data can be raised via
[GitHub Issues](https://github.com/LordZed86/DeQueue/issues).
