# Firefox Add-ons (AMO) — Submission Requirements & Checklist

Living checklist for what addons.mozilla.org requires before DeQueue can be
submitted/published, and what we currently have vs. still need. Update the
checkboxes as items are resolved — don't let this drift from ROADMAP.md's
pre-publish section.

Sources: [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
[Extensions and the add-on ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/),
[Manifest V3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/),
[Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/),
[browser_specific_settings — MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).
Checked as of 2026-07; policy pages change without notice — re-verify against
the live docs before actually submitting.

---

## Account setup

- ⏳ Register a Firefox Add-on Developer account (free, no fee unlike
  Chrome).

---

## Manifest / code requirements

- ✅ **Manifest V3.** Already on MV3.
- ⏳ **`browser_specific_settings.gecko.id` required for MV3.** Unlike MV2
  (where the ID is optional), MV3 extensions must set an explicit ID before
  submission. Format: an email-like string, e.g.
  `dequeue@<yourdomain-or-handle>.example` — the `@string` form is fine and
  doesn't need to resolve to a real address. Not currently present in
  `src/manifest.json` — needs to be added under a new
  `browser_specific_settings` key.
- ⏳ **`gecko.data_collection_permissions` disclosure.** New Mozilla
  requirement effective 2025-11-03 for newly submitted extensions (full
  rollout to all extensions in first half of 2026): must declare, in the
  manifest, what data (if any) is collected/transmitted. DeQueue transmits
  nothing off-device, so this should be a straightforward "none of the
  above" declaration once we add the key — but it must be explicit, not
  just true by omission. Needs to be filled in alongside the `gecko.id`
  addition above.
- ✅ **Source review.** AMO requires reviewable source for all submissions,
  including transpiled/minified code. We ship plain, unbuilt JS — nothing
  to explain or provide separately here, unlike projects with a bundler
  step.
- ✅ **File size.** 200 MB max for validation to pass — nowhere close, not a
  concern for this project.
- ✅ **Permissions.** Same underlying concern as the Chrome checklist, fixed
  once for both: the persistent `<all_urls>` content script is gone,
  replaced with on-demand `chrome.scripting.executeScript` injection into
  the active tab via `activeTab` + `scripting`. No host permissions
  requested.

---

## Privacy policy

- ⏳ **No longer required to be hosted on AMO itself** (policy simplified
  2025-06). Developers are now encouraged to link to a self-hosted privacy
  policy instead of pasting one into an AMO-hosted field. Since we're
  already writing one for the Chrome Web Store listing (see
  `chrome_web_store.md`), the same document/URL can be linked here — no
  separate policy needed, just make sure the link is added to the AMO
  listing once the policy exists.

---

## Store listing assets

- ⏳ **Description** for the AMO listing.
- ⏳ **Screenshots** — same captures used for the Chrome listing should be
  reusable here; confirm AMO's size/format constraints match before
  reusing verbatim.
- ✅ **Icon.** Same `icon128.png` as the Chrome listing — regenerated from
  source SVG, no longer a blank placeholder (see `chrome_web_store.md`).
- ⏳ **Category** selection during listing setup.

---

## Review process notes

- AMO runs automated validation on submission (can fail fast on manifest
  errors, e.g. missing `gecko.id` for MV3); manual review may follow and
  can take longer. Budget for iteration time, not a same-day turnaround.
- Signing/publishing after validation passes can take up to 24 hours,
  longer if flagged for manual review.

---

## Summary: blockers vs. nice-to-haves

**Real blockers to submission:**

1. Missing `browser_specific_settings.gecko.id` in `manifest.json` — MV3
   submissions are rejected by automated validation without it.
2. Missing `gecko.data_collection_permissions` declaration.
3. No developer account registered yet.
4. No listing assets yet.

**Not required (already resolved by policy, no action needed):**

- Hosting a privacy policy directly on AMO — link to the self-hosted one
  instead, once it exists.
