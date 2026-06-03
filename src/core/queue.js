/**
 * SessionQueue — a simple FIFO queue that holds the knapsack-selected items
 * for one reading session.
 *
 * The popup shows one item at a time. The user clicks Done or Skip to advance.
 * Done marks the item completed in storage; Skip puts it back at the end of
 * the queue so it stays available this session without being lost.
 *
 * This is also the literal namesake of the app: you DeQueue from DeQueue.
 */

/**
 * @typedef {import('./knapsack.js').KnapsackItem} KnapsackItem
 */

export class SessionQueue {
  /**
   * @param {KnapsackItem[]} items - Ordered list from knapsack output
   */
  constructor(items = []) {
    this._items = [...items];
  }

  /** Total number of items remaining in the queue (including current). */
  get size() {
    return this._items.length;
  }

  /** True when there are no items left. */
  get isEmpty() {
    return this._items.length === 0;
  }

  /**
   * Returns the current item (front of queue) without removing it.
   * Returns null if the queue is empty.
   * @returns {KnapsackItem | null}
   */
  peek() {
    return this._items[0] ?? null;
  }

  /**
   * Removes and returns the front item (Done / advance to next).
   * Returns null if the queue is empty.
   * @returns {KnapsackItem | null}
   */
  dequeue() {
    return this._items.shift() ?? null;
  }

  /**
   * Moves the current item to the back of the queue (Skip).
   * No-ops if the queue is empty.
   */
  skip() {
    if (this.isEmpty) return;
    this._items.push(this._items.shift());
  }

  /**
   * Returns a snapshot of all remaining items in order, without mutating the queue.
   * Useful for rendering a progress indicator ("1 of 4").
   * @returns {KnapsackItem[]}
   */
  toArray() {
    return [...this._items];
  }
}

/**
 * Builds a SessionQueue from the knapsack result, ordering items by
 * descending value score so the highest-priority item surfaces first.
 *
 * @param {KnapsackItem[]} selectedItems - The `selected` array from knapsack()
 * @returns {SessionQueue}
 */
export function buildSessionQueue(selectedItems) {
  const ordered = [...selectedItems].sort((a, b) => b.value - a.value);
  return new SessionQueue(ordered);
}
