# Chrome Web Store — Submission Requirements & Checklist

Living checklist for what the Chrome Web Store requires before DeQueue can be
submitted/published, and what we currently have vs. still need. Update the
checkboxes as items are resolved — don't let this drift from ROADMAP.md's
pre-publish section.

Sources: [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies),
[Listing Requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements/),
[MV3 Requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements),
[Privacy Policies](https://developer.chrome.com/docs/webstore/program-policies/privacy),
[Register a developer account](https://developer.chrome.com/docs/webstore/register).
Checked as of 2026-07; policy pages change without notice — re-verify against
the live docs before actually submitting.

---

## Account setup

- ⏳ Register a Chrome Web Store developer account (one-time $5 fee), verify
  developer email.
- ⏳ (Optional) Verified publisher badge — requires domain verification
  (~$10–15/yr). Not required to publish; skip unless we want the badge.

---

## Manifest / code requirements

- ✅ **Manifest V3.** Already on MV3 (`manifest_version: 3`).
- ⏳ **MV3 code-visibility rule.** "Full functionality must be easily
  discernible from submitted code" — no `eval()` of remote strings, no
  fetching-and-interpreting remote code, no script tags pointing outside the
  package. We ship plain, unminified JS with no build step and no remote
  fetches of executable code — this should already pass, but worth a final
  read-through of `background.js` and `content.js` immediately before
  submission to confirm nothing was added that violates it.
- 🔄 **Narrowest permissions necessary.** Currently requests `storage`,
  `activeTab`, `scripting`, plus a `content_scripts` block matching
  `<all_urls>` (persistent injection on every page load). `<all_urls>` is
  broader than the use case needs — see the on-demand-injection rework
  tracked in ROADMAP.md pre-publish checklist. Target: drop the persistent
  `content_scripts` entry, inject via `chrome.scripting.executeScript` from
  the popup on the active tab only, rely on `activeTab` instead of a host
  permission.
- ⏳ **Single purpose.** Extension must have one narrow, easy-to-understand
  purpose, stated clearly in the dashboard's single-purpose field. Ours:
  "save articles/videos and build a time-boxed session from them via
  knapsack prioritization." Draft this field's exact wording during listing
  setup.
- ⏳ **Permission justifications.** Each requested permission needs a
  dashboard field explaining why it's needed. Draft ahead of time:
  - `storage` — persist saved items, settings, and points locally.
  - `activeTab` — read metadata (title/description/type/duration/topic)
    from the tab the user is actively adding, only when they invoke the
    extension.
  - `scripting` — inject the metadata-extraction function into the active
    tab on demand (replaces persistent `content_scripts` once reworked).

---

## Privacy policy

- ⏳ **Privacy policy required.** Any product handling user data needs an
  accurate, up-to-date privacy policy linked from the dashboard's privacy
  field. DeQueue reads page metadata (title, description, type, duration,
  topic) from the active tab and stores saved items/settings in
  `localStorage` / `chrome.storage.session` — no server, no accounts, no
  data leaves the device. That's a straightforward policy to write (data
  collected, why, "never transmitted, stored locally only"), but it doesn't
  exist yet. Needs to be hosted somewhere reachable by URL — a repo-hosted
  `PRIVACY.md` rendered via GitHub Pages, or similar, would satisfy this
  without needing a separate site.
- ⏳ **Data-usage disclosure fields** in the dashboard (what's collected, how
  it's used, whether sold/shared with third parties — all "no" for us)
  must match the privacy policy and the code's actual behavior.

---

## Store listing assets

- ⏳ **Description.** Short + detailed descriptions for the listing (distinct
  from `manifest.json`'s description field).
- ⏳ **Screenshots.** 1–5 required, actual extension UI (not marketing
  graphics), 1280×800 or 640×400. None exist yet — need to capture the
  popup in its main states (empty queue, add-item, active session, done).
- ✅ **Store icon, 128×128.** `icon128.png` in `src/assets/icons/` was
  regenerated from `icon.svg` (the PNGs had gone stale and were rendering
  as a blank background square, missing the "DQ" wordmark and underline
  accent from the source SVG). Icons at all three sizes (16/48/128) now
  match the source design.
- ⏳ **Category and language** selection in the dashboard.

---

## Pre-submission functional check

- ⏳ Load unpacked in Chrome, run through the full flow (add item → build
  session → done/skip → options page) with a clean profile, confirm no
  console errors.
- ⏳ Confirm `docs/ROADMAP.md`'s pre-publish hallway-testing checklist
  (topic scraping accuracy, interest toggle UX, mood bias UX) is closed out
  — not a store requirement, but a self-imposed quality gate ahead of going
  live to real users.

---

## Summary: blockers vs. nice-to-haves

**Real blockers to submission:**

1. No privacy policy (required given current data handling + permissions).
2. `<all_urls>` content script is broader than necessary and likely to draw
   manual-review scrutiny or rejection — narrowing to on-demand
   `activeTab` + `scripting` injection avoids this.
3. No developer account registered yet.
4. No listing assets (screenshots, descriptions) yet.

**Everything else above is doable in parallel** and isn't blocking, but
should be done before clicking submit rather than after.
