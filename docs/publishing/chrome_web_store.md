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

- ✅ Chrome Web Store developer account registered (individual/non-trader —
  no business entity, no monetization currently; revisit classification if
  that changes later).
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
- ✅ **Narrowest permissions necessary.** Requests only `storage`,
  `activeTab`, `scripting` — no host permissions. The persistent
  `content_scripts` (`<all_urls>`) block is gone; `background.js` injects
  `content/content.js` on demand via `chrome.scripting.executeScript` into
  the active tab only, triggered when the popup opens. See ROADMAP.md for
  implementation notes.
- 🔄 **Single purpose.** Extension must have one narrow, easy-to-understand
  purpose, stated clearly in the dashboard's single-purpose field. Drafted
  in `store_listing.md` — still needs to be pasted into the dashboard during
  listing setup.
- 🔄 **Permission justifications.** Each requested permission needs a
  dashboard field explaining why it's needed. Drafted in `store_listing.md`
  — still needs to be pasted into the dashboard.

---

## Privacy policy

- 🔄 **Privacy policy required.** Written — canonical source is
  `docs/pages/index.md` (root `PRIVACY.md` is a stub pointing there) —
  covers what's read (on-demand active-tab metadata: title, description,
  type, duration, topic), what's stored (items/settings/achievements/
  streaks/points, all local via `localStorage` / `chrome.storage.session`),
  and confirms no server, no accounts, nothing transmitted off-device.
  Hosting via GitHub Pages, deployed by
  `.github/workflows/pages.yml` (GitHub Actions method, publishing only
  `docs/pages/` — not all of `docs/`, to keep the churning ROADMAP/dev-log
  docs from becoming public pages). Will publish to
  `https://lordzed86.github.io/DeQueue/` once Pages is enabled in repo
  Settings → Pages (source: "GitHub Actions") — a one-time manual step in
  the GitHub web UI.
- ⏳ **Data-usage disclosure fields** in the dashboard (what's collected, how
  it's used, whether sold/shared with third parties — all "no" for us)
  must match the privacy policy and the code's actual behavior.

---

## Store listing assets

- 🔄 **Description.** Short + detailed descriptions written in
  `store_listing.md` (distinct from `manifest.json`'s description field) —
  still needs to be pasted into the dashboard.
- 🔄 **Screenshots.** 1–5 required, actual extension UI (not marketing
  graphics), 1280×800 or 640×400. 5 captured, covering queue view, add-item
  (autofilled), active session, session complete, and options — see
  `docs/screenshots/` (also embedded in the README). Still need to be
  uploaded to the dashboard.
- ✅ **Store icon, 128×128.** `icon128.png` in `src/assets/icons/` was
  regenerated from `icon.svg` (the PNGs had gone stale and were rendering
  as a blank background square, missing the "DQ" wordmark and underline
  accent from the source SVG). Icons at all three sizes (16/48/128) now
  match the source design.
- 🔄 **Category and language** selection in the dashboard. Suggested
  category (**Productivity**) drafted in `store_listing.md`; language is a
  dashboard dropdown pick, no drafting needed.

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

1. Privacy policy written (`PRIVACY.md`) but not yet hosted at a public URL
   — needed for the dashboard's privacy field.
2. Everything else (screenshots, descriptions, single-purpose/permission
   justifications, category) is drafted/captured — see `store_listing.md`
   and `docs/screenshots/` — and just needs uploading/pasting into the
   dashboard during actual submission.

**Everything else above is doable in parallel** and isn't blocking, but
should be done before clicking submit rather than after.
