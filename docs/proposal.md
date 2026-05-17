# CS 398 Final Project Proposal

Kellen Jones  
CS 398 - Algorithmic Problem Solving  
Instructor: Bill McCoy  
Spring 2026

---

## 1. Project Title

**DeQueue** — A Knapsack-Based Content Prioritizer for ADHD Users

---

## 2. Overview

A lot of people with ADHD end up with massive backlogs of articles, videos, and research links they fully intend to get to — and then never do. The list grows, the guilt builds, and eventually it becomes easier to ignore the whole thing than to figure out where to start. This pattern is sometimes called "data hoarding," and it's well-documented in the ADHD community (see References).

DeQueue is a browser-based tool that addresses this directly. Users save links to a personal collection and tag each one with metadata: estimated read/watch time, topic, interest level, and energy required. When they're ready to actually sit down and consume something, they tell DeQueue how much time they have, and the app generates an optimized session — a curated shortlist that fits within that budget and maximizes value based on their preferences. Think of it as a smarter, kinder version of a reading list. The whole thing runs locally in the browser with no backend required.

---

## 3. Algorithmic Core

The core of DeQueue is a variant of the **0/1 knapsack problem**. Each saved item has:

- A **weight** — estimated time to complete (in minutes, 'discretized' to keep the DP table clean)
- A **value** — a priority score derived from user-assigned interest, recency, and how long the item has been sitting in the queue

When a user starts a session and sets a time budget, the algorithm selects a subset of items that maximizes total value without exceeding the time limit. I'll implement this using dynamic programming and verify correctness against a brute-force solution on small inputs.

On top of the core selection, the app will support secondary sorting and filtering — by mood, topic, or recency — which introduces a lightweight scoring/ranking layer. As a stretch goal, I'd like to explore grouping related items by topic using a simple similarity measure, which could draw on clustering or graph concepts. But the knapsack engine is the guaranteed core.

This maps well to the course themes of optimization, tradeoff analysis, and choosing the right algorithmic approach for a constrained decision problem. The name "DeQueue" is a nod to the deque data structure — a double-ended queue — which felt appropriate for something that's constantly pulling items off a list.

---

## 4. Planned Scope

For this course, I'm planning to build:

- A form to add items (URL, title, estimated time, topic tag, interest rating)
  - possibility of auto fill from things like users reading list or youtube account.
- Local browser storage for the item list — no backend
  - ideally all data gets stored on the client system for data privacy and control
- A session generator: user sets a time budget, algorithm returns an optimized selection
  - possibility of linking program to users calendar for to generate an initial set on launch
- Basic to slightly complex sorting and filtering UI (by topic, recency, or mood tag)
- Mark-as-done tracking with a simple points counter
  - possibility of removing complete items from users various services (browsers reading list, close tabs, mark remove from youtube)
- A minimal gamification layer — points accumulate as items are completed, with potential for cosmetic rewards (stretch goal)

I'm intentionally keeping the scope tight around the knapsack engine and core UI. Stretch goals include topic clustering, an algorithm visualizer, user statistics, and a more fleshed-out reward system — but none of those feel required for a solid submission.

---

## 5. AI-Assisted Workflow

I'm planning to use GitHub Copilot throughout. Specifically:

- **Implementation help** — boilerplate UI components, utility functions, wiring up local storage
- **Algorithm iteration** — once I've designed the core knapsack logic myself, Copilot can help me refactor and optimize it
- **Test generation** — suggesting edge cases I might not think of
- **Debugging** — talking through unexpected behavior

The problem analysis, algorithm selection, and evaluation of results will be my own work. I'll document where AI assistance was used and how I assessed or modified its suggestions as part of the final writeup.

---

## 6. Testing / Verification Plan

I'll verify correctness at a few levels:

- **Happy path** — small, known sets of items with clear time values, checked against a hand-computed brute-force solution
- **Edge cases** — empty list, single item, budget of zero, all items over budget, all items with identical values
- **Stress test** — 50–100 items to check DP table performance and correctness at scale
- **UI behavior** — completed items don't resurface in future sessions; points accumulate correctly; filtering doesn't break the selection logic

One likely failure mode I want to address early: floating-point time estimates breaking the DP table. I'll discretize everything to integer minutes on input. Another one: the algorithm always surfacing the same high-value items. I may add a small decay factor so long-ignored items gradually gain priority.

---

## 7. Distinctness from Other Coursework

This project isn't connected to capstone or any other course right now — it's being built entirely for CS 398. If it turns out well, I might expand it into something larger down the road, but any future work would be a separate deliverable. What gets submitted here will be a self-contained project created for this course.

---

## 8. Questions / Uncertainties

- **Fractional time estimates** — I'm planning to round to the nearest minute, but I want to think through whether that creates meaningful errors for short items (e.g., a 90-second video vs. a 2-minute video)
- **Value function weighting** — how much to weight recency vs. user-assigned interest, and whether to expose that as a user setting without making the UI annoying
- **Metadata fetching** — is it feasible to auto-pull reading time estimates from a URL in a purely browser-based app, or should I just require manual entry to start?
- **Obtaining time estimates** - how will I consistently get Time estimates for articles/videos/tasks
- **Gamification scope** — I may simplify the reward system to just a counter for now and revisit if there's time

---

## References (This section will probably be moved to a design doc in the future)

*To be expanded — these are starting points for the problem motivation.*

- Morein-Zamir, S., Kasese, M., Chamberlain, S. R., & Trachtenberg, E. (2022). Elevated levels of hoarding in ADHD: A special link with inattention. *Journal of Psychiatric Research, 145*, 167–174. [doi.org](https://doi.org/10.1016/j.jpsychires.2021.12.024)
  - Key finding: nearly 1 in 5 adults with ADHD exhibited clinically significant hoarding symptoms; the study found a strong link specifically with inattention rather than hyperactivity.

- Sedera, D. et al. (2022). Modern-day hoarding: A model for understanding and measuring digital hoarding. *Southern Cross University Digital Enterprise Lab.*
  - Key finding: in a sample of 846 participants, 37% reported that digital hoarding led to feelings of anxiety.

- Maynard, S. (2021). Information overload and ADHD. *ADDitude Magazine.* [additudemag.com](https://www.additudemag.com/too-much-information/)
  - Practical overview of why people with ADHD are disproportionately affected by information overload and accumulation.

- *(Knapsack / DP algorithm references placeholder)*
- *(Additional ADHD + productivity / tools placeholder)*
