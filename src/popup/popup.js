import { getPendingItems, saveItem, deleteItem, markCompleted, markInProgress, clearInProgress, getSettings, saveSettings, saveSession, loadSession, clearSession, getStreak, updateStreak, getTotalCompleted, getUnlockedAchievements, unlockAchievement, getPoints, addPoints } from "../utils/storage.js";
import { ACHIEVEMENTS, checkAchievements } from "../utils/achievements.js";
import { scoreItems } from "../utils/scoring.js";
import { knapsack } from "../core/knapsack.js";
import { SessionQueue, buildSessionQueue } from "../core/queue.js";

// ── State ──────────────────────────────────────────────────
let sessionQueue = null;
let sessionPointsEarned = 0;
let sessionItemsCompleted = 0;
let sessionStartTime = null;
let filterTopic = "";
let filterMood = "";
let sortBy = "score";

// ── DOM refs ───────────────────────────────────────────────
const viewQueue = document.getElementById("view-queue");
const viewAdd = document.getElementById("view-add");
const viewSession = document.getElementById("view-session");

const pointsDisplay = document.getElementById("points-display");
const streakDisplay = document.getElementById("streak-display");
const itemList = document.getElementById("item-list");
const itemCount = document.getElementById("item-count");
const emptyState = document.getElementById("empty-state");
const budgetInput = document.getElementById("budget-input");
const moodSelect = document.getElementById("mood-select");

const btnSettings = document.getElementById("btn-settings");
const btnAchievements = document.getElementById("btn-achievements");
const btnCloseAchievements = document.getElementById("btn-close-achievements");
const achievementsPanel = document.getElementById("achievements-panel");
const achievementsList = document.getElementById("achievements-list");
const achievementToast = document.getElementById("achievement-toast");

const filterTopicEl = document.getElementById("filter-topic");
const filterMoodEl = document.getElementById("filter-mood");
const sortByEl = document.getElementById("sort-by");

const btnGenerate = document.getElementById("btn-generate");
const btnAddItem = document.getElementById("btn-add-item");
const btnBackFromAdd = document.getElementById("btn-back-from-add");
const addForm = document.getElementById("add-form");
const addError = document.getElementById("add-error");
const autofillHint = document.getElementById("autofill-hint");

const btnEndSession = document.getElementById("btn-end-session");
const sessionProgress = document.getElementById("session-progress");
const sessionCard = document.getElementById("session-card");
const cardType = document.getElementById("card-type");
const cardTitle = document.getElementById("card-title");
const cardUrl = document.getElementById("card-url");
const cardTime = document.getElementById("card-time");
const cardTopic = document.getElementById("card-topic");
const sessionComplete = document.getElementById("session-complete");
const sessionActions = document.getElementById("session-actions");
const completeItems = document.getElementById("complete-items");
const completePoints = document.getElementById("complete-points");
const completeStreak = document.getElementById("complete-streak");
const btnDone = document.getElementById("btn-done");
const btnSkip = document.getElementById("btn-skip");
const btnSessionDone = document.getElementById("btn-session-done");

const interestToggleRow = document.getElementById("interest-toggle-row");
const interestInput = document.getElementById("input-interest");

// ── View helpers ───────────────────────────────────────────
function showView(view) {
  viewQueue.classList.add("hidden");
  viewAdd.classList.add("hidden");
  viewSession.classList.add("hidden");
  view.classList.remove("hidden");
}

// ── Points ─────────────────────────────────────────────────
function renderPoints() {
  pointsDisplay.textContent = `${getPoints()} pts`;
  const { count } = getStreak();
  streakDisplay.textContent = count > 0 ? `🔥 ${count}` : "";
}

// ── Achievements ───────────────────────────────────────────
let toastTimer = null;

function showToast(achievement) {
  achievementToast.textContent = `${achievement.emoji} Achievement unlocked: ${achievement.name}`;
  achievementToast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => achievementToast.classList.add("hidden"), 3500);
}

function checkAndUnlock() {
  const stats = {
    totalCompleted: getTotalCompleted(),
    streakCount: getStreak().count,
    sessionDurationMs: sessionStartTime ? Date.now() - sessionStartTime : null,
    sessionItemsCompleted,
  };
  const unlocked = getUnlockedAchievements();
  const newlyUnlocked = checkAchievements(stats, unlocked);
  for (const a of newlyUnlocked) {
    unlockAchievement(a.id);
    showToast(a);
  }
}

function renderAchievementsPanel() {
  const unlocked = getUnlockedAchievements();
  achievementsList.innerHTML = "";
  for (const a of ACHIEVEMENTS) {
    const li = document.createElement("li");
    li.className = "achievement-item" + (unlocked.has(a.id) ? " achievement-item--unlocked" : " achievement-item--locked");
    li.innerHTML = `<span class="achievement-emoji">${unlocked.has(a.id) ? a.emoji : "🔒"}</span>
      <div>
        <div class="achievement-name">${escHtml(a.name)}</div>
        <div class="achievement-desc">${escHtml(a.desc)}</div>
      </div>`;
    achievementsList.appendChild(li);
  }
}

btnAchievements.addEventListener("click", () => {
  renderAchievementsPanel();
  achievementsPanel.classList.toggle("hidden");
});

btnCloseAchievements.addEventListener("click", () => {
  achievementsPanel.classList.add("hidden");
});

// ── Queue view ─────────────────────────────────────────────
function populateTopicFilter(items) {
  const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))].sort();
  const current = filterTopicEl.value;
  filterTopicEl.innerHTML = '<option value="">All topics</option>';
  topics.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if (t === current) opt.selected = true;
    filterTopicEl.appendChild(opt);
  });
}

function applyFilterSort(items) {
  let result = items;

  if (filterTopic) result = result.filter((i) => i.topic === filterTopic);
  if (filterMood)  result = result.filter((i) => i.mood === filterMood);

  const scored = scoreItems(result, { currentMood: moodSelect.value || null });

  if (sortBy === "score")    scored.sort((a, b) => b.value - a.value);
  if (sortBy === "interest") scored.sort((a, b) => b.interest - a.interest);
  if (sortBy === "recency")  scored.sort((a, b) => b.addedAt - a.addedAt);
  if (sortBy === "time")     scored.sort((a, b) => a.timeEstimate - b.timeEstimate);

  // In-progress item always floats to the top regardless of sort
  scored.sort((a, b) => (b.inProgress ? 1 : 0) - (a.inProgress ? 1 : 0));

  return scored;
}

function renderQueueView() {
  const pending = getPendingItems();
  const settings = getSettings();

  budgetInput.value = settings.defaultBudget ?? 20;
  if (settings.defaultMood) moodSelect.value = settings.defaultMood;

  populateTopicFilter(pending);

  const visible = applyFilterSort(pending);

  itemList.innerHTML = "";

  if (pending.length === 0) {
    emptyState.classList.remove("hidden");
    itemCount.textContent = "0 items";
  } else {
    emptyState.classList.add("hidden");
    const label = filterTopic || filterMood
      ? `${visible.length} of ${pending.length} item${pending.length !== 1 ? "s" : ""}`
      : `${pending.length} item${pending.length !== 1 ? "s" : ""}`;
    itemCount.textContent = label;
    visible.forEach((item) => itemList.appendChild(buildItemCard(item)));
  }

  renderPoints();
}

function interestLabel(interest) {
  if (interest === 1) return `<span class="interest-badge interest-badge--low">Low priority</span>`;
  if (interest === 3) return `<span class="interest-badge interest-badge--high">High priority</span>`;
  return "";
}

function buildItemCard(item) {
  const li = document.createElement("li");
  li.className = "item-card" + (item.inProgress ? " item-card--inprogress" : "");
  li.innerHTML = `
    <div class="item-card-body">
      <div class="item-card-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
      <div class="item-card-meta">
        <span>${item.timeEstimate} min</span>
        ${item.topic ? `<span>${escHtml(item.topic)}</span>` : ""}
        ${interestLabel(item.interest)}
        ${item.inProgress ? `<span class="badge-inprogress">In progress</span>` : ""}
      </div>
    </div>
    <button class="item-card-delete" data-id="${item.id}" aria-label="Delete ${escHtml(item.title)}">✕</button>
  `;
  li.querySelector(".item-card-delete").addEventListener("click", () => {
    deleteItem(item.id);
    renderQueueView();
  });
  return li;
}

// ── Session persistence ────────────────────────────────────
async function persistSession() {
  if (!sessionQueue || sessionQueue.isEmpty) return;
  await saveSession({ items: sessionQueue.toArray(), pointsEarned: sessionPointsEarned });
}

// ── Session generation ─────────────────────────────────────
async function generateSession() {
  const budget = parseInt(budgetInput.value, 10);
  const mood = moodSelect.value || null;

  if (!budget || budget < 1) return;

  // Save current budget/mood as defaults for next time
  saveSettings({ defaultBudget: budget, defaultMood: mood });

  const pending = getPendingItems();
  if (pending.length === 0) return;

  const inProgressItem = pending.find((i) => i.inProgress) ?? null;
  let resume = false;

  if (inProgressItem) {
    resume = confirm(`Resume "${inProgressItem.title}"?`);
  }

  const poolItems = inProgressItem
    ? pending.filter((i) => i.id !== inProgressItem.id)
    : pending;
  const remainingBudget = resume
    ? Math.max(0, budget - inProgressItem.timeEstimate)
    : budget;

  const scored = scoreItems(poolItems, { currentMood: mood });
  const result = knapsack(remainingBudget, scored);

  const selected = resume
    ? [inProgressItem, ...result.selected]
    : result.selected;

  if (selected.length === 0) {
    return;
  }

  sessionQueue = buildSessionQueue(selected);
  sessionPointsEarned = 0;
  sessionItemsCompleted = 0;
  sessionStartTime = Date.now();
  await persistSession();
  showView(viewSession);
  renderSessionCard();
}

// ── Session view ───────────────────────────────────────────
function renderSessionCard() {
  if (sessionQueue.isEmpty) {
    sessionCard.classList.add("hidden");
    sessionActions.classList.add("hidden");
    sessionComplete.classList.remove("hidden");
    completeItems.textContent = sessionItemsCompleted > 0
      ? `${sessionItemsCompleted} item${sessionItemsCompleted !== 1 ? "s" : ""} completed`
      : "";
    completePoints.textContent = sessionPointsEarned > 0
      ? `+${sessionPointsEarned} points earned`
      : "";
    const { count } = getStreak();
    completeStreak.textContent = count > 1 ? `🔥 ${count} day streak!` : count === 1 ? `🔥 Streak started!` : "";
    return;
  }

  const item = sessionQueue.peek();
  const total = sessionQueue.toArray().length;

  sessionProgress.textContent = `${total} remaining`;
  cardType.textContent = item.contentType ?? "";
  cardTitle.textContent = item.title;

  if (item.url) {
    cardUrl.textContent = item.url;
    cardUrl.href = item.url;
    cardUrl.classList.remove("hidden");
    cardUrl.onclick = () => markInProgress(item.id);
  } else {
    cardUrl.classList.add("hidden");
    cardUrl.onclick = null;
  }

  cardTime.textContent = `${item.timeEstimate} min`;
  cardTopic.textContent = item.topic ?? "";
}

// ── Add item form ──────────────────────────────────────────
function resetAddForm() {
  addForm.reset();
  interestInput.value = "2";
  renderInterestToggle("2");
  addError.classList.add("hidden");
  addError.textContent = "";
  autofillHint.classList.add("hidden");
  autofillHint.textContent = "";

  // Ask the background worker to relay page metadata from the content script.
  // In MV3 the popup cannot message content scripts directly.
  chrome.runtime?.sendMessage({ type: "GET_PAGE_META" }, (meta) => {
    if (chrome.runtime.lastError || !meta) {
      // Content script isn't reachable on this tab — restricted page
      // (chrome://, store pages) or a tab opened before the extension
      // loaded. Not an error; just let the user know autofill won't work
      // here so manual entry doesn't feel like a silent failure.
      autofillHint.textContent = "Couldn't read this page — enter details manually.";
      autofillHint.classList.remove("hidden");
      return;
    }
    if (meta.url) document.getElementById("input-url").value = meta.url;
    if (meta.title) document.getElementById("input-title").value = meta.title;
    if (meta.timeEstimate) document.getElementById("input-time").value = meta.timeEstimate;
    if (meta.contentType) document.getElementById("input-content-type").value = meta.contentType;
  });
}

function handleAddSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("input-title").value.trim();
  const timeRaw = parseInt(document.getElementById("input-time").value, 10);
  const interestParsed = parseInt(interestInput.value, 10);
  const interest = interestParsed >= 1 && interestParsed <= 3 ? interestParsed : 2;

  if (!title) {
    showAddError("Title is required.");
    return;
  }
  if (!timeRaw || timeRaw < 1) {
    showAddError("Time estimate must be at least 1 minute.");
    return;
  }

  const item = {
    id: globalThis.crypto.randomUUID(),
    url: document.getElementById("input-url").value.trim() || null,
    title,
    timeEstimate: timeRaw,
    contentType: document.getElementById("input-content-type").value,
    topic: document.getElementById("input-topic").value.trim() || null,
    interest,
    mood: document.getElementById("input-mood").value || null,
    addedAt: Date.now(),
    completed: false,
    completedAt: null,
  };

  saveItem(item);
  showView(viewQueue);
  renderQueueView();
}

function showAddError(msg) {
  addError.textContent = msg;
  addError.classList.remove("hidden");
}

// ── Interest toggle ─────────────────────────────────────────
// Neutral (2) by default. Pressing Low or High nudges away from neutral;
// pressing the same button again returns to neutral. Skipping it entirely
// is a valid, no-friction choice — interest never blocks saving an item.
function renderInterestToggle(value) {
  interestToggleRow.querySelectorAll(".interest-toggle").forEach((btn) => {
    const isActive = btn.dataset.value === String(value) && String(value) !== "2";
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

interestToggleRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".interest-toggle");
  if (!btn) return;
  const clicked = btn.dataset.value;
  const next = interestInput.value === clicked ? "2" : clicked;
  interestInput.value = next;
  renderInterestToggle(next);
});

btnSettings.addEventListener("click", () => {
  chrome.runtime?.openOptionsPage?.();
});

// ── Filter / sort wiring ───────────────────────────────────
filterTopicEl.addEventListener("change", () => {
  filterTopic = filterTopicEl.value;
  renderQueueView();
});

filterMoodEl.addEventListener("change", () => {
  filterMood = filterMoodEl.value;
  renderQueueView();
});

sortByEl.addEventListener("change", () => {
  sortBy = sortByEl.value;
  renderQueueView();
});

// ── Event wiring ───────────────────────────────────────────
btnAddItem.addEventListener("click", () => {
  showView(viewAdd);
  resetAddForm();
});

btnBackFromAdd.addEventListener("click", () => {
  showView(viewQueue);
});

btnGenerate.addEventListener("click", generateSession);

addForm.addEventListener("submit", handleAddSubmit);

btnDone.addEventListener("click", async () => {
  const item = sessionQueue.dequeue();
  if (item) {
    markCompleted(item.id);
    clearInProgress();
    updateStreak();
    addPoints(10);
    renderPoints();
    sessionPointsEarned += 10;
    sessionItemsCompleted += 1;
    checkAndUnlock();
  }
  if (sessionQueue.isEmpty) {
    await clearSession();
  } else {
    await persistSession();
  }
  renderSessionCard();
});

btnSkip.addEventListener("click", async () => {
  sessionQueue.skip();
  await persistSession();
  renderSessionCard();
});

btnEndSession.addEventListener("click", () => {
  // Flag the current item as interrupted so it surfaces at the top of the queue
  if (sessionQueue && !sessionQueue.isEmpty) {
    const current = sessionQueue.peek();
    if (current) markInProgress(current.id);
  }
  sessionQueue = null;
  clearSession();
  showView(viewQueue);
  renderQueueView();
});

btnSessionDone.addEventListener("click", () => {
  sessionQueue = null;
  clearSession();
  showView(viewQueue);
  renderQueueView();
});

// ── Escape helper ──────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Init ───────────────────────────────────────────────────
(async () => {
  const saved = await loadSession();
  if (saved?.items?.length) {
    sessionQueue = new SessionQueue(saved.items);
    sessionPointsEarned = saved.pointsEarned ?? 0;
    await persistSession();
    showView(viewSession);
    renderSessionCard();
  } else {
    renderQueueView();
  }
})();
