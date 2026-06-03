// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import {
  getItems,
  saveItem,
  updateItem,
  deleteItem,
  markCompleted,
  getPendingItems,
  getSettings,
  saveSettings,
  clearAll,
  KEYS,
} from "./storage.js";

// Minimal valid item factory
const makeItem = (overrides = {}) => ({
  id: "item-1",
  url: "https://example.com",
  title: "Test Article",
  timeEstimate: 10,
  interest: 3,
  addedAt: Date.now(),
  completed: false,
  completedAt: null,
  contentType: "article",
  ...overrides,
});

// Reset storage before every test so nothing bleeds between cases
beforeEach(() => {
  clearAll();
});

// ─── getItems ─────────────────────────────────────────────────────────────────

describe("getItems", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(getItems()).toEqual([]);
  });

  it("returns an empty array when the stored value is corrupt JSON", () => {
    localStorage.setItem(KEYS.ITEMS, "not valid json{{{");
    expect(getItems()).toEqual([]);
  });

  it("returns items that were previously saved", () => {
    const item = makeItem();
    saveItem(item);
    expect(getItems()).toHaveLength(1);
    expect(getItems()[0].id).toBe("item-1");
  });
});

// ─── saveItem ─────────────────────────────────────────────────────────────────

describe("saveItem", () => {
  it("appends a new item to an empty store", () => {
    saveItem(makeItem({ id: "a" }));
    expect(getItems()).toHaveLength(1);
  });

  it("appends without overwriting existing items", () => {
    saveItem(makeItem({ id: "a" }));
    saveItem(makeItem({ id: "b" }));
    const items = getItems();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("persists all item fields", () => {
    const item = makeItem({ id: "z", title: "My Article", interest: 5 });
    saveItem(item);
    const stored = getItems()[0];
    expect(stored.title).toBe("My Article");
    expect(stored.interest).toBe(5);
  });
});

// ─── updateItem ───────────────────────────────────────────────────────────────

describe("updateItem", () => {
  it("replaces the matching item in place", () => {
    saveItem(makeItem({ id: "x", interest: 2 }));
    updateItem(makeItem({ id: "x", interest: 5 }));
    expect(getItems()[0].interest).toBe(5);
  });

  it("does not affect other items", () => {
    saveItem(makeItem({ id: "a" }));
    saveItem(makeItem({ id: "b", interest: 1 }));
    updateItem(makeItem({ id: "a", interest: 5 }));
    const b = getItems().find((i) => i.id === "b");
    expect(b.interest).toBe(1);
  });

  it("no-ops silently when the id does not exist", () => {
    saveItem(makeItem({ id: "a" }));
    expect(() => updateItem(makeItem({ id: "does-not-exist" }))).not.toThrow();
    expect(getItems()).toHaveLength(1);
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe("deleteItem", () => {
  it("removes the item with the matching id", () => {
    saveItem(makeItem({ id: "del" }));
    deleteItem("del");
    expect(getItems()).toHaveLength(0);
  });

  it("does not remove other items", () => {
    saveItem(makeItem({ id: "keep" }));
    saveItem(makeItem({ id: "del" }));
    deleteItem("del");
    const remaining = getItems();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("keep");
  });

  it("no-ops silently when the id does not exist", () => {
    saveItem(makeItem({ id: "a" }));
    expect(() => deleteItem("does-not-exist")).not.toThrow();
    expect(getItems()).toHaveLength(1);
  });
});

// ─── markCompleted ────────────────────────────────────────────────────────────

describe("markCompleted", () => {
  it("sets completed to true", () => {
    saveItem(makeItem({ id: "done" }));
    markCompleted("done");
    expect(getItems()[0].completed).toBe(true);
  });

  it("records the completedAt timestamp", () => {
    const ts = 1_700_000_000_000;
    saveItem(makeItem({ id: "done" }));
    markCompleted("done", ts);
    expect(getItems()[0].completedAt).toBe(ts);
  });

  it("defaults completedAt to roughly now when not provided", () => {
    const before = Date.now();
    saveItem(makeItem({ id: "done" }));
    markCompleted("done");
    const after = Date.now();
    const { completedAt } = getItems()[0];
    expect(completedAt).toBeGreaterThanOrEqual(before);
    expect(completedAt).toBeLessThanOrEqual(after);
  });

  it("does not affect other items", () => {
    saveItem(makeItem({ id: "done" }));
    saveItem(makeItem({ id: "pending" }));
    markCompleted("done");
    const pending = getItems().find((i) => i.id === "pending");
    expect(pending.completed).toBe(false);
  });

  it("no-ops silently when the id does not exist", () => {
    saveItem(makeItem({ id: "a" }));
    expect(() => markCompleted("does-not-exist")).not.toThrow();
    expect(getItems()[0].completed).toBe(false);
  });
});

// ─── getPendingItems ──────────────────────────────────────────────────────────

describe("getPendingItems", () => {
  it("returns only incomplete items", () => {
    saveItem(makeItem({ id: "done", completed: true }));
    saveItem(makeItem({ id: "pending", completed: false }));
    const pending = getPendingItems();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("pending");
  });

  it("returns all items when none are completed", () => {
    saveItem(makeItem({ id: "a" }));
    saveItem(makeItem({ id: "b" }));
    expect(getPendingItems()).toHaveLength(2);
  });

  it("returns empty array when all items are completed", () => {
    saveItem(makeItem({ id: "a", completed: true }));
    expect(getPendingItems()).toHaveLength(0);
  });

  it("returns empty array when store is empty", () => {
    expect(getPendingItems()).toHaveLength(0);
  });
});

// ─── getSettings ─────────────────────────────────────────────────────────────

describe("getSettings", () => {
  it("returns defaults when nothing is stored", () => {
    const settings = getSettings();
    expect(settings.defaultBudget).toBe(20);
    expect(settings.defaultMood).toBeNull();
    expect(settings.weights).toBeNull();
  });

  it("merges stored values over defaults", () => {
    saveSettings({ defaultBudget: 45 });
    const settings = getSettings();
    expect(settings.defaultBudget).toBe(45);
    expect(settings.defaultMood).toBeNull(); // default preserved
  });

  it("returns defaults when stored value is corrupt JSON", () => {
    localStorage.setItem(KEYS.SETTINGS, "{{bad json");
    const settings = getSettings();
    expect(settings.defaultBudget).toBe(20);
  });
});

// ─── saveSettings ─────────────────────────────────────────────────────────────

describe("saveSettings", () => {
  it("persists a single field without wiping others", () => {
    saveSettings({ defaultBudget: 30 });
    saveSettings({ defaultMood: "focus" });
    const settings = getSettings();
    expect(settings.defaultBudget).toBe(30);
    expect(settings.defaultMood).toBe("focus");
  });

  it("overwrites a previously saved value", () => {
    saveSettings({ defaultBudget: 30 });
    saveSettings({ defaultBudget: 45 });
    expect(getSettings().defaultBudget).toBe(45);
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe("clearAll", () => {
  it("removes all items", () => {
    saveItem(makeItem());
    clearAll();
    expect(getItems()).toHaveLength(0);
  });

  it("removes all settings", () => {
    saveSettings({ defaultBudget: 45 });
    clearAll();
    expect(getSettings().defaultBudget).toBe(20); // back to default
  });

  it("does not affect unrelated localStorage keys", () => {
    localStorage.setItem("some-other-key", "value");
    clearAll();
    expect(localStorage.getItem("some-other-key")).toBe("value");
  });
});
