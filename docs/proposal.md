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

DeQueue is a browser-based tool that addresses this directly[^1]. Users save links to a personal collection and tag each one with metadata: estimated read/watch time, topic, interest level, and energy required. When they're ready to actually sit down and consume something, they tell DeQueue how much time they have, and the app generates an optimized session — a curated shortlist that fits within that budget and maximizes value based on their preferences. Think of it as a smarter, kinder version of a reading list. The whole thing runs locally in the browser with no backend required[^2].

[^1]: This is not set in stone yet, I would prefer this be more client side software/app based so the end product isn't constrained to internet based backlogs.
[^2]: I was originally thinking of a browser extension, but that also limits the evolution of how this tool could be used.

---

## 3. Algorithmic Core

The core of DeQueue is a variant of the **0/1 knapsack problem**. Each saved item has:

- A **weight** — estimated time to complete (in minutes, 'discretized' to keep the DP table clean)
- A **value** — a priority score derived from user-assigned interest, recency, and how long the item has been sitting in the queue

When a user starts a session and sets a time budget:

- the algorithm selects a subset of items
- maximizes total value without exceeding the time limit.

I'll implement this using dynamic programming[^3] and verify correctness against a brute-force solution on small inputs.

On top of the core selection:

- the app will support secondary sorting and filtering
  - by mood
  - topic
  - recency
  - which introduces a lightweight scoring/ranking layer

As a stretch goal, I'd like to explore grouping related items by topic using a similarity measure, which could draw on graph theory concepts[^4], But the knapsack engine is the guaranteed core.

This seems to align with the courses themes of optimization, tradeoff analysis, and choosing the right algorithmic approach for a constrained decision problem. The name "DeQueue" is a nod to the deque data structure — a double-ended queue — which felt appropriate for something that's constantly pulling items off a list.

[^3]: I have little experience with dynamic programming principals, so this will add some difficulty to the scope of things.
[^4]: This is a new concept to me, so it may or may not be included in the form of a similarity metric algorithm like the few I have seen.

---

## 4. Planned Scope

For this course, I'm planning to build:

- (**P0**) A form to add items (URL, title, estimated time, topic tag, interest rating)
  - (**P2**) auto fill from things like users reading list or youtube account.
- (**P0**) Local browser storage for the item list — no backend
  - (**NOTE**) ideally all data gets stored on the client system
- (**P0**) A session generator: user sets a time budget, algorithm returns an optimized selection
  (**P2**) linking program to users calendar for to generate an initial set on launch
- (**P1**) Basic to slightly complex sorting and filtering UI (by topic, recency, or mood tag)
- (**P1**) Mark-as-done tracking with a simple points counter
  - (**P2**) Removing completed items from users various services automatically (browsers reading list, close tabs, mark remove from youtube)
- (**P1**) A minimal gamification layer — points accumulate as items are completed, with potential for cosmetic rewards (stretch goal to add interest and promote the habit of using the program)

I'm intentionally keeping the scope tight around the knapsack engine and core UI as `**P0**` and `**P1**` to have a solid Minimum Viable Product (MVP) byt the end of the quarter.

Stretch goals `**P2**` include:

- Auto-filling items to the program
- Calendar linking to pull time availability
- Auto-removal of item from its home service
- Topic clustering
- Algorithm visualizer
- User statistics
- A more fleshed-out reward system

none of these feel required for a good MBP and a solid submission, but would make good additions in the long run and would add more depth to my project if my initial scope proves to be less time consuming than estimated.

---

## 5. AI-Assisted Workflow

I'm planning to use AI to increase my productivity but in as minimal a scope as possible to explore and research how to utilize it as an effective tool and familiarize myself with it since I will most likely be forced to use it in industry at some point with the current trends.

**Initial use cases include:**

- **Implementation help** — boilerplate UI components, utility functions
- **Documentation** - helping to create `JSDocs` and `comments`.
- **Test generation** — suggesting edge cases I might not think of
- **Debugging** — talking through unexpected behavior

The problem analysis, algorithm selection, UI design and evaluation of results will be my own work. I'll document where AI assistance was used and how I assessed or modified its suggestions along the way In an `AI Use Disclaimer` section inside the `README.md`.

---

## 6. Testing / Verification Plan

I'll verify correctness at a few levels:

- **Happy path** — small, known sets of items with clear time values, checked against a hand-computed brute-force solution
- **Edge cases** — empty list, single item, budget of zero, all items over budget, all items with identical values
- **Stress test** — 50–100 items to check DP table performance and correctness at scale
- **UI behavior** — completed items don't resurface in future sessions; points accumulate correctly; filtering doesn't break the selection logic
- **Hallway Testing** - My wife loves to break things I build... which makes her the perfect outside tester; she also has her masters in psychology and works as a therapist specializing in ADD/ADHD so she will be valuable for technical insight on the effectiveness of the program.

### Possible Failures

| Failure | Mitigation |
| --- | --- |
| Floating-point time estimates breaking the table | I'll discretize everything to integer minutes on input |
| Algorithm always surfacing at the same high-value items | A small decay factor could make long-ignored items gradually gain priority |

---

## 7. Distinctness from Other Coursework

This project isn't connected to a capstone or any other course right now — it's being built entirely for CS 398. If it turns out well, I might expand it into something larger down the road, but any future work would be a separate deliverable. What gets submitted here will be a self-contained project created for this course.

---

## 8. Questions / Uncertainties

- **Fractional time estimates** — I'm planning to round to the nearest minute, but I want to think through whether that creates meaningful errors for short items (e.g., a 90-second video vs. a 2-minute video)
- **Value function weighting** — how much to weight recency vs. user-assigned interest, and whether to expose that as a user setting without making the UI annoying
- **Metadata fetching** — is it feasible to auto-pull reading time estimates from a URL in a purely browser-based app, or should I just require manual entry to start?
- **Obtaining time estimates** - how consistent will time estimates for articles/videos/tasks be.
- **Gamification scope** — I may simplify the reward system to just a counter for now and revisit if there's time

---

## References (This section will probably be moved to a design doc in the future)

*To be expanded — these are starting points and initial research for the problem motivation.*

- Morein-Zamir, S., Kasese, M., Chamberlain, S. R., & Trachtenberg, E. (2022). Elevated levels of hoarding in ADHD: A special link with inattention. *Journal of Psychiatric Research, 145*, 167–174. [Journal of Psychiatric Research](https://doi.org/10.1016/j.jpsychires.2021.12.024)
  - Key finding: nearly 1 in 5 adults with ADHD exhibited clinically significant hoarding symptoms; the study found a strong link specifically with inattention rather than hyperactivity.

- Sedera, D. et al. (2022). Modern-day hoarding: A model for understanding and measuring digital hoarding. [*Southern Cross University Digital Enterprise Lab.*](https://www.sciencedirect.com/science/article/abs/pii/S0378720622001094)
  - Key finding: in a sample of 846 participants, 37% reported that digital hoarding led to feelings of anxiety.

- Maynard, S. (2021). Information overload and ADHD. *ADDitude Magazine.* [additudemag.com](https://www.additudemag.com/too-much-information/)
  - Practical overview of why people with ADHD are disproportionately affected by information overload and accumulation.

- *(Knapsack / DP algorithm references placeholder)*
- *(Additional ADHD + productivity / tools placeholder)*
