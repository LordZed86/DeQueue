import { getItems, getPendingItems, saveItem, deleteItem, markCompleted, getSettings, saveSettings } from "../utils/storage.js";
import { scoreItems } from "../utils/scoring.js";
import { knapsack } from "../core/knapsack.js";
import { buildSessionQueue } from "../core/queue.js";

// ── State ──────────────────────────────────────────────────
let sessionQueue = null;
let sessionPointsEarned = 0;

// ── DOM refs ───────────────────────────────────────────────
const viewQueue = document.getElementById("view-queue");
const viewAdd = document.getElementById("view-add");
const viewSession = document.getElementById("view-session");

const pointsDisplay = document.getElementById("points-display");
const itemList = document.getElementById("item-list");
const itemCount = document.getElementById("item-count");
const emptyState = document.getElementById("empty-state");
const budgetInput = document.getElementById("budget-input");
const moodSelect = document.getElementById("mood-select");

const btnGenerate = document.getElementById("btn-generate");
const btnAddItem = document.getElementById("btn-add-item");
const btnBackFromAdd = document.getElementById("btn-back-from-add");
const addForm = document.getElementById("add-form");
const addError = document.getElementById("add-error");

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
const completePoints = document.getElementById("complete-points");
const btnDone = document.getElementById("btn-done");
const btnSkip = document.getElementById("btn-skip");
const btnSessionDone = document.getElementById("btn-session-done");

const starRow = document.getElementById("star-row");
const interestInput = document.getElementById("input-interest");

// ── View helpers ───────────────────────────────────────────
function showView(view) {
  viewQueue.classList.add("hidden");
  viewAdd.classList.add("hidden");
  viewSession.classList.add("hidden");
  view.classList.remove("hidden");
}

// ── Points ─────────────────────────────────────────────────
function getPoints() {
  return parseInt(localStorage.getItem("dequeue_points") ?? "0", 10);
}

function addPoints(n) {
  const total = getPoints() + n;
  localStorage.setItem("dequeue_points", String(total));
  renderPoints();
}

function renderPoints() {
  pointsDisplay.textContent = `${getPoints()} pts`;
}

// ── Queue view ─────────────────────────────────────────────
function renderQueueView() {
  const pending = getPendingItems();
  const settings = getSettings();

  budgetInput.value = settings.defaultBudget ?? 20;
  if (settings.defaultMood) moodSelect.value = settings.defaultMood;

  itemList.innerHTML = "";

  if (pending.length === 0) {
    emptyState.classList.remove("hidden");
    itemCount.textContent = "0 items";
  } else {
    emptyState.classList.add("hidden");
    itemCount.textContent = `${pending.length} item${pending.length !== 1 ? "s" : ""}`;
    pending.forEach((item) => itemList.appendChild(buildItemCard(item)));
  }

  renderPoints();
}

function buildItemCard(item) {
  const li = document.createElement("li");
  li.className = "item-card";
  li.innerHTML = `
    <div class="item-card-body">
      <div class="item-card-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
      <div class="item-card-meta">
        <span>${item.timeEstimate} min</span>
        ${item.topic ? `<span>${escHtml(item.topic)}</span>` : ""}
        <span>${"★".repeat(item.interest)}</span>
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

// ── Session generation ─────────────────────────────────────
function generateSession() {
  const budget = parseInt(budgetInput.value, 10);
  const mood = moodSelect.value || null;

  if (!budget || budget < 1) return;

  // Save current budget/mood as defaults for next time
  saveSettings({ defaultBudget: budget, defaultMood: mood });

  const pending = getPendingItems();
  if (pending.length === 0) return;

  const scored = scoreItems(pending, { currentMood: mood });
  const result = knapsack(budget, scored);

  if (result.selected.length === 0) {
    // Nothing fits — could show a toast, but just return for now
    return;
  }

  sessionQueue = buildSessionQueue(result.selected);
  sessionPointsEarned = 0;
  showView(viewSession);
  renderSessionCard();
}

// ── Session view ───────────────────────────────────────────
function renderSessionCard() {
  if (sessionQueue.isEmpty) {
    sessionCard.classList.add("hidden");
    sessionActions.classList.add("hidden");
    sessionComplete.classList.remove("hidden");
    completePoints.textContent = sessionPointsEarned > 0
      ? `+${sessionPointsEarned} points earned`
      : "";
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
  } else {
    cardUrl.classList.add("hidden");
  }

  cardTime.textContent = `${item.timeEstimate} min`;
  cardTopic.textContent = item.topic ?? "";
}

// ── Add item form ──────────────────────────────────────────
function resetAddForm() {
  addForm.reset();
  interestInput.value = "3";
  renderStars(3);
  addError.classList.add("hidden");
  addError.textContent = "";

  // Ask the content script for page metadata if we can
  chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_META" }, (meta) => {
      if (chrome.runtime.lastError || !meta) return;
      if (meta.url) document.getElementById("input-url").value = meta.url;
      if (meta.title) document.getElementById("input-title").value = meta.title;
      if (meta.timeEstimate) document.getElementById("input-time").value = meta.timeEstimate;
      if (meta.contentType) document.getElementById("input-content-type").value = meta.contentType;
    });
  });
}

function handleAddSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("input-title").value.trim();
  const timeRaw = parseInt(document.getElementById("input-time").value, 10);
  const interest = parseInt(interestInput.value, 10);

  if (!title) {
    showAddError("Title is required.");
    return;
  }
  if (!timeRaw || timeRaw < 1) {
    showAddError("Time estimate must be at least 1 minute.");
    return;
  }
  if (!interest || interest < 1 || interest > 5) {
    showAddError("Please select an interest rating.");
    return;
  }

  const item = {
    id: globalThis.crypto.randomUUID(),
    url: document.getElementById("input-url").value.trim() || null,
    title,
    timeEstimate: timeRaw,
    weight: timeRaw, // knapsack uses .weight
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

// ── Star rating ────────────────────────────────────────────
function renderStars(value) {
  starRow.querySelectorAll(".star").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.value, 10) <= value);
  });
}

starRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".star");
  if (!btn) return;
  const value = parseInt(btn.dataset.value, 10);
  interestInput.value = value;
  renderStars(value);
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

btnDone.addEventListener("click", () => {
  const item = sessionQueue.dequeue();
  if (item) {
    markCompleted(item.id);
    addPoints(10);
    sessionPointsEarned += 10;
  }
  renderSessionCard();
});

btnSkip.addEventListener("click", () => {
  sessionQueue.skip();
  renderSessionCard();
});

btnEndSession.addEventListener("click", () => {
  sessionQueue = null;
  showView(viewQueue);
  renderQueueView();
});

btnSessionDone.addEventListener("click", () => {
  sessionQueue = null;
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
renderQueueView();
