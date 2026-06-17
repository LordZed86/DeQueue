# DeQueue — Brainstorm & Ideas

A running collection of ideas, observations, and thoughts from throughout the project. Not a spec — just thinking out loud.

---

## The Original Idea

People with ADHD often have a habit of "data hoarding" — keeping dozens of articles, videos, etc. they want to read or watch later. They often feel overwhelmed by the list and start to feel guilt for not getting through it.

The idea: a storage and organization system for these data hoards. Save articles and videos in one place, sort by time, topic, or mood, and surface them in a way that removes the paralysis of choosing. Some kind of ranked choice — maybe knapsack? Graph theory could come into play too. To encourage actually getting through the hoard, gamify it with points or coins that could be spent on themes or skins.

Immediately landed on knapsack. "I have 20 minutes, what should I do?" is literally a capacity-constrained optimization problem.

Ideally everything stays local — no backend, no accounts.

---

## Core Ideas

### Algorithm

- 0/1 knapsack via bottom-up dynamic programming
- 2D table `dp[i][w]` — keeps full row history so we can backtrack and recover which items were selected, not just the best total value
- Backtracking walks from `dp[n][budget]` upward: if a row's value changed, that item was included
- Budget capped at 60 minutes — matches the real use case (gap-filling, not day-planning)
- Items with weight 0 or over the cap are filtered before the table is built
- `knapsackBruteForce` alongside the DP version for test verification — checks all 2^n subsets, only practical for n ≤ 15
- Time complexity: O(n × W), effectively O(n) since W is fixed at 60
- Space complexity: O(n × W) for the 2D table

### Scoring

- Four factors, each normalized to [0, 1] before weighting so no single factor can dominate by scale:
  - Interest — user's 1–5 rating
  - Recency — items added today score highest, decaying linearly to 0 at 30 days
  - Staleness — inverse of recency; items sitting the longest get a boost
  - Mood match — binary bonus if the user's current mood matches the item's mood tag
- Weights live in `DEFAULT_WEIGHTS`; caller can pass custom weights
- Key insight discovered during testing: recency and staleness cancel each other out under equal weights — the combined contribution is always constant regardless of age. The weights need to be asymmetric to actually differentiate items by age.
- Expose scoring weights as user settings — let power users tune interest vs. staleness vs. recency to match their own patterns

### Queue

- One item at a time — reduces choice paralysis, which is the same problem the whole app addresses
- Done marks complete and advances; Skip cycles to the back (item stays available this session)
- The naming pun: the user literally dequeues from DeQueue

### Storage

- Thin wrapper around `localStorage` + `chrome.storage.session` — nothing else touches storage directly
- `getItems()` / `getSettings()` never throw — return safe defaults on missing or corrupt data
- `clearAll()` removes only DeQueue keys, not all of localStorage
- Session state in `chrome.storage.session` — survives popup close and tab switches, auto-clears on browser restart

### Extension

- Manifest V3, targeting Firefox and Chrome/Brave
- Minimum permissions: `storage`, `activeTab`, `scripting`
- Popup has three views (queue list, add item, session) — only one visible at a time, back button nav
- MV3 constraint: popup cannot message content scripts directly — all cross-context messaging goes through the background service worker

### Content Script

- Scrapes active page on demand when user opens "Add Item"
- Extraction priority per field: `og:*` → `twitter:*` → DOM fallback → null
- Video duration: YouTube DOM → `VideoObject` JSON-LD
- Read time: `twitter:data1` (Medium) → article word count ÷ 200 wpm → main word count
- Every extractor returns null on failure — never blocks manual entry
- `cleanDocumentTitle()` strips " - Site Name" / " | Site Name" suffixes — fixes Wikipedia and similar sites

### Gamification

- Points per completed item; session complete screen shows items completed, points earned, and streak
- Streak counter shown in header alongside points
- Achievement system — milestones, locked/unlocked display, toast fires on unlock
- Unlockable themes / skins — original gamification idea; cosmetics remain a stretch goal

### UI / UX

- Queue view with sort and filter controls — topic, mood, content type
- Sort by priority, interest, recency, time
- Item count shows "X of Y" when filtered
- In-progress flag — interrupting a session flags the current item; it pins to the top with a badge on next open
- In-progress resume prompt — Generate Session asks to resume when an in-progress item exists; yes prepends it and reduces budget, no excludes it this session
- Session summary on complete — items done, points earned, streak message
- Options page — weight sliders (auto-normalized), default budget, default mood

---

## Future Ideas

### Near-term

- JSON export / import — backup queue to a file, restore on a new browser or after a reset
- Topic clustering — group by topic tag using a graph/similarity approach; this is where graph theory comes back in from the original idea
- Mood preset rework — fixed set (focus, low-energy, curious, quick) instead of free-text tag; easier to match, better for scoring
- Scoring weight tuning — expose the recency vs. staleness tradeoff as a user-facing bias slider
- Safari support — WebExtensions API is mostly compatible; would need testing and a possible manifest tweak
- Article / video only mode — filter sessions by content type (e.g. no audio at work)
- Long-form library — a separate space for items over 60 minutes (painting tutorials, documentaries, deep-dives) that sits outside the knapsack; when you have open-ended time DeQueue surfaces what's waiting so you don't have to make that call yourself

### Stretch

- Auto-import from Pocket / Instapaper / Readwise / YouTube Watch Later — removes manual entry entirely
- Auto-remove from source — after marking done, optionally archive in the external list so it stays clean
- Calendar integration — detect free time blocks in Google Calendar and pre-generate a session that fits the next gap
- Item organization — folder hierarchy or directory view for when the queue gets large
- Algorithm visualizer — show the DP table filling in real time as the session generates; great for the CS class demo
- User stats dashboard — total items completed, minutes consumed, streaks, most-read topics; counters the guilt from the unread pile
- Weight experimentation UI — tunable sliders for all scoring factors so users can find the weighting pattern that matches how their brain prioritizes

---

## Design Questions

### Resolved

- Popup nav — back button, one view at a time (not persistent bottom nav)
- Points counter — points + streak + achievements; toast + panel for unlocks
- localStorage vs. IndexedDB — localStorage for now; all access behind `storage.js` so migration is a single-file change
- Max budget — 60 minutes; gap-filling use case, not day-planning
- 1D vs. 2D DP table — 2D; backtracking requires full row history
- Skip behavior — cycle to back; item stays available this session
- Scoring weights — user-configurable via options page sliders with auto-normalization
- Session persistence — `chrome.storage.session`; auto-clears on browser restart

### Still Open

- Single topic tag vs. array of tags — array is more flexible but complicates filter UI
- Staleness ceiling — 30 days feels right but should it be user-adjustable?
- Recency vs. staleness weight asymmetry — equal weights cancel out; which direction should the default favor?
- YouTube scraper — worth maintaining given how often YouTube's DOM changes?
- Export/import format — plain JSON, or something compatible with Pocket/Instapaper?

---

## Color Schemes & Design Ideas

All themes follow the same principle: soft pastels on dark backgrounds, low visual noise, nothing that competes with the content. ADHD-intentional — the UI should feel calm and focused, not stimulating.

The CSS variable structure is already set up for theming — swapping a theme is just replacing the `:root` block.

---

### Current — Midnight Navy

The default. Deep cool blues with a warm red accent. High contrast without being harsh.

```css
--color-bg:           #1a1a2e;  /* deep navy */
--color-surface:      #16213e;  /* slightly lighter navy */
--color-surface-2:    #0f3460;  /* card/raised surface */
--color-accent:       #e94560;  /* red-pink */
--color-accent-hover: #c73652;
--color-text:         #eaeaea;
--color-text-muted:   #888888;
--color-border:       #2a2a4a;
--color-star-on:      #f5c518;  /* gold star */
```

---

### Catppuccin Mocha

The reference. Warm dark base, soft pastel accents. Every color is intentionally low-saturation so nothing screams at you. Mauve as the accent keeps it calm but distinct.

```css
--color-bg:           #1e1e2e;  /* base */
--color-surface:      #313244;  /* surface0 */
--color-surface-2:    #45475a;  /* surface1 */
--color-accent:       #cba6f7;  /* mauve */
--color-accent-hover: #b4a0e0;
--color-text:         #cdd6f4;  /* text */
--color-text-muted:   #6c7086;  /* overlay0 */
--color-border:       #45475a;  /* surface1 */
--color-star-on:      #f9e2af;  /* yellow */
```

---

### Catppuccin Macchiato

Slightly darker and cooler than Mocha. Same family, slightly more blue-shifted. Good if Mocha feels too warm.

```css
--color-bg:           #24273a;  /* base */
--color-surface:      #363a4f;  /* surface0 */
--color-surface-2:    #494d64;  /* surface1 */
--color-accent:       #c6a0f6;  /* mauve */
--color-accent-hover: #b08ee0;
--color-text:         #cad3f5;  /* text */
--color-text-muted:   #6e738d;  /* overlay0 */
--color-border:       #494d64;  /* surface1 */
--color-star-on:      #eed49f;  /* yellow */
```

---

### Rose Pine

Very popular in the same space as Catppuccin. Warm dark purples, dusty rose accent. Feels cozy and literary — good fit for a reading queue.

```css
--color-bg:           #191724;  /* base */
--color-surface:      #1f1d2e;  /* surface */
--color-surface-2:    #26233a;  /* overlay */
--color-accent:       #eb6f92;  /* love (rose) */
--color-accent-hover: #d45c7e;
--color-text:         #e0def4;  /* text */
--color-text-muted:   #6e6a86;  /* subtle */
--color-border:       #26233a;  /* overlay */
--color-star-on:      #f6c177;  /* gold */
```

---

### Tokyo Night

Cool dark blues and purples, cyan/teal accent. More blue-shifted than the others, feels modern and focused. Popular for long work sessions.

```css
--color-bg:           #1a1b26;  /* bg */
--color-surface:      #24283b;  /* bg_highlight */
--color-surface-2:    #292e42;  /* bg_dark */
--color-accent:       #7dcfff;  /* cyan */
--color-accent-hover: #5db8f0;
--color-text:         #c0caf5;  /* fg */
--color-text-muted:   #565f89;  /* comment */
--color-border:       #292e42;
--color-star-on:      #e0af68;  /* yellow */
```

---

### Everforest Dark

Muted greens and warm browns on a dark forest base. The most "low stimulation" option — earthy, grounded, nothing sharp. Good for a relaxed reading mode vibe.

```css
--color-bg:           #2d353b;  /* bg0 */
--color-surface:      #343f44;  /* bg1 */
--color-surface-2:    #3d484d;  /* bg2 */
--color-accent:       #a7c080;  /* green */
--color-accent-hover: #8aab63;
--color-text:         #d3c6aa;  /* fg */
--color-text-muted:   #7a8478;  /* grey1 */
--color-border:       #3d484d;  /* bg2 */
--color-star-on:      #dbbc7f;  /* yellow */
```

---

### Gruvbox Dark

Retro warm palette — amber, orange, and muted greens on a deep brown-gray base. High readability, very easy on the eyes over long sessions.

```css
--color-bg:           #282828;  /* bg */
--color-surface:      #3c3836;  /* bg1 */
--color-surface-2:    #504945;  /* bg2 */
--color-accent:       #fabd2f;  /* yellow */
--color-accent-hover: #d9a61a;
--color-text:         #ebdbb2;  /* fg */
--color-text-muted:   #928374;  /* gray */
--color-border:       #504945;  /* bg2 */
--color-star-on:      #fabd2f;  /* yellow */
```

---

### Design Notes

- **Typography:** system font stack is fine for now; a rounded sans like Inter or Nunito would reinforce the soft/calm feel
- **Border radius:** current `8px` is good — soft without being bubbly
- **Spacing:** generous padding on cards reduces visual clutter, especially important for ADHD users scanning a list
- **Animations:** subtle fade/slide on view transitions would feel polished without being distracting — keep under 150ms
- **Streak / achievement colors:** warm accent (gold, amber, rose) works well for reward moments regardless of theme — it should feel different from the neutral UI accent
- **Focus states:** visible but not jarring; colored outline matching the accent at low opacity is enough

---

## Hallway Testing Notes

Short beta session surfaced these:

- Mark things as visited when opening an item so if interrupted partway through it doesn't show as complete
- Session consistency — session was resetting when opening an item in a new tab because the popup closes
- Autofill title was hit or miss on some sites
- Article or video only mode — useful at work where you can't play audio
- Ability to tag mood or incorporate topic into the algorithm so users can pinpoint something like "creative" or "research"
- Long-form items — handle things over 60 min elegantly; a weekend mode for painting tutorials and long videos
- Item organization — if the queue fills up a directory or folder structure would help
- Site compatibility — tested across YouTube, Reddit, Medium, Wikipedia, news sites
