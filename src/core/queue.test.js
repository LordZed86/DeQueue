import { describe, it, expect } from "vitest";
import { SessionQueue, buildSessionQueue } from "./queue.js";

const item = (id, value = 50, weight = 10) => ({ id, value, weight });

// ─── constructor ──────────────────────────────────────────────────────────────

describe("SessionQueue constructor", () => {
  it("starts with the provided items", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    expect(q.size).toBe(2);
  });

  it("defaults to empty when called with no arguments", () => {
    const q = new SessionQueue();
    expect(q.isEmpty).toBe(true);
    expect(q.size).toBe(0);
  });

  it("does not mutate the original array", () => {
    const original = [item("a"), item("b")];
    new SessionQueue(original);
    expect(original).toHaveLength(2);
  });
});

// ─── peek ─────────────────────────────────────────────────────────────────────

describe("peek", () => {
  it("returns the front item without removing it", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    expect(q.peek()?.id).toBe("a");
    expect(q.size).toBe(2);
  });

  it("returns null when the queue is empty", () => {
    expect(new SessionQueue().peek()).toBeNull();
  });
});

// ─── dequeue ──────────────────────────────────────────────────────────────────

describe("dequeue", () => {
  it("removes and returns the front item", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    const removed = q.dequeue();
    expect(removed?.id).toBe("a");
    expect(q.size).toBe(1);
    expect(q.peek()?.id).toBe("b");
  });

  it("returns null when the queue is empty", () => {
    expect(new SessionQueue().dequeue()).toBeNull();
  });

  it("empties the queue after dequeuing all items", () => {
    const q = new SessionQueue([item("a")]);
    q.dequeue();
    expect(q.isEmpty).toBe(true);
  });

  it("preserves FIFO order across multiple dequeues", () => {
    const q = new SessionQueue([item("a"), item("b"), item("c")]);
    expect(q.dequeue()?.id).toBe("a");
    expect(q.dequeue()?.id).toBe("b");
    expect(q.dequeue()?.id).toBe("c");
    expect(q.isEmpty).toBe(true);
  });
});

// ─── skip ─────────────────────────────────────────────────────────────────────

describe("skip", () => {
  it("moves the front item to the back", () => {
    const q = new SessionQueue([item("a"), item("b"), item("c")]);
    q.skip();
    expect(q.peek()?.id).toBe("b");
    expect(q.toArray().at(-1)?.id).toBe("a");
  });

  it("does not change size", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    q.skip();
    expect(q.size).toBe(2);
  });

  it("no-ops on an empty queue without throwing", () => {
    const q = new SessionQueue();
    expect(() => q.skip()).not.toThrow();
    expect(q.size).toBe(0);
  });

  it("on a single-item queue, the same item stays at the front", () => {
    const q = new SessionQueue([item("only")]);
    q.skip();
    expect(q.peek()?.id).toBe("only");
    expect(q.size).toBe(1);
  });

  it("cycling through all items via skip eventually cycles back to the first", () => {
    const q = new SessionQueue([item("a"), item("b"), item("c")]);
    q.skip(); // b, c, a
    q.skip(); // c, a, b
    q.skip(); // a, b, c
    expect(q.peek()?.id).toBe("a");
  });
});

// ─── toArray ──────────────────────────────────────────────────────────────────

describe("toArray", () => {
  it("returns a copy of the remaining items in order", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    const arr = q.toArray();
    expect(arr.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the queue when the returned array is modified", () => {
    const q = new SessionQueue([item("a"), item("b")]);
    q.toArray().pop();
    expect(q.size).toBe(2);
  });

  it("returns an empty array for an empty queue", () => {
    expect(new SessionQueue().toArray()).toEqual([]);
  });
});

// ─── buildSessionQueue ────────────────────────────────────────────────────────

describe("buildSessionQueue", () => {
  it("orders items by descending value score", () => {
    const items = [item("low", 30), item("high", 90), item("mid", 60)];
    const q = buildSessionQueue(items);
    const order = q.toArray().map((i) => i.id);
    expect(order).toEqual(["high", "mid", "low"]);
  });

  it("the highest-value item is at the front (peek)", () => {
    const items = [item("a", 10), item("b", 80), item("c", 50)];
    const q = buildSessionQueue(items);
    expect(q.peek()?.id).toBe("b");
  });

  it("does not mutate the original items array", () => {
    const items = [item("a", 10), item("b", 80)];
    buildSessionQueue(items);
    expect(items[0].id).toBe("a");
  });

  it("returns an empty queue for an empty input", () => {
    const q = buildSessionQueue([]);
    expect(q.isEmpty).toBe(true);
  });

  it("handles a single item", () => {
    const q = buildSessionQueue([item("solo", 75)]);
    expect(q.size).toBe(1);
    expect(q.peek()?.id).toBe("solo");
  });

  it("handles items with equal values without throwing", () => {
    const items = [item("a", 50), item("b", 50), item("c", 50)];
    const q = buildSessionQueue(items);
    expect(q.size).toBe(3);
  });
});
