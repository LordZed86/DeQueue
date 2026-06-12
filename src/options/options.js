import { getSettings, saveSettings } from "../utils/storage.js";
import { DEFAULT_WEIGHTS } from "../utils/scoring.js";

// ── DOM refs ───────────────────────────────────────────────
const budgetInput    = document.getElementById("default-budget");
const moodSelect     = document.getElementById("default-mood");

const sliderInterest  = document.getElementById("weight-interest");
const sliderRecency   = document.getElementById("weight-recency");
const sliderStaleness = document.getElementById("weight-staleness");
const sliderMood      = document.getElementById("weight-mood");

const valInterest  = document.getElementById("val-interest");
const valRecency   = document.getElementById("val-recency");
const valStaleness = document.getElementById("val-staleness");
const valMood      = document.getElementById("val-mood");

const btnSave    = document.getElementById("btn-save");
const btnReset   = document.getElementById("btn-reset");
const saveStatus = document.getElementById("save-status");

// ── Slider display ─────────────────────────────────────────
function pct(slider) {
  return `${slider.value}%`;
}

function syncLabels() {
  valInterest.textContent  = pct(sliderInterest);
  valRecency.textContent   = pct(sliderRecency);
  valStaleness.textContent = pct(sliderStaleness);
  valMood.textContent      = pct(sliderMood);
}

[sliderInterest, sliderRecency, sliderStaleness, sliderMood].forEach((s) =>
  s.addEventListener("input", syncLabels)
);

// ── Load saved settings ────────────────────────────────────
function loadFromStorage() {
  const s = getSettings();

  budgetInput.value = s.defaultBudget ?? 20;
  moodSelect.value  = s.defaultMood ?? "";

  const w = s.weights ?? DEFAULT_WEIGHTS;
  sliderInterest.value  = Math.round((w.interest  ?? DEFAULT_WEIGHTS.interest)  * 100);
  sliderRecency.value   = Math.round((w.recency   ?? DEFAULT_WEIGHTS.recency)   * 100);
  sliderStaleness.value = Math.round((w.staleness ?? DEFAULT_WEIGHTS.staleness) * 100);
  sliderMood.value      = Math.round((w.moodMatch ?? DEFAULT_WEIGHTS.moodMatch) * 100);

  syncLabels();
}

// ── Save ───────────────────────────────────────────────────
function save() {
  const budget = parseInt(budgetInput.value, 10);
  if (!budget || budget < 1) return;

  const rawSum =
    parseInt(sliderInterest.value, 10) +
    parseInt(sliderRecency.value, 10) +
    parseInt(sliderStaleness.value, 10) +
    parseInt(sliderMood.value, 10);

  // Normalize weights so they always sum to 1
  const sum = rawSum || 1;
  const weights = {
    interest:  parseInt(sliderInterest.value, 10)  / sum,
    recency:   parseInt(sliderRecency.value, 10)   / sum,
    staleness: parseInt(sliderStaleness.value, 10) / sum,
    moodMatch: parseInt(sliderMood.value, 10)       / sum,
  };

  saveSettings({
    defaultBudget: budget,
    defaultMood:   moodSelect.value || null,
    weights,
  });

  saveStatus.textContent = "Saved!";
  setTimeout(() => (saveStatus.textContent = ""), 2000);
}

// ── Reset ──────────────────────────────────────────────────
function reset() {
  budgetInput.value = 20;
  moodSelect.value  = "";
  sliderInterest.value  = Math.round(DEFAULT_WEIGHTS.interest  * 100);
  sliderRecency.value   = Math.round(DEFAULT_WEIGHTS.recency   * 100);
  sliderStaleness.value = Math.round(DEFAULT_WEIGHTS.staleness * 100);
  sliderMood.value      = Math.round(DEFAULT_WEIGHTS.moodMatch * 100);
  syncLabels();
}

btnSave.addEventListener("click", save);
btnReset.addEventListener("click", reset);

loadFromStorage();
