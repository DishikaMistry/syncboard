// Local offline operation queue. Persisted to localStorage so a page refresh while
// offline doesn't lose queued edits (per "no data loss under any single-client
// disconnect" requirement).

const STORAGE_KEY = 'syncboard:op-queue';

export function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueOp(op) {
  const queue = loadQueue();
  queue.push(op);
  saveQueue(queue);
  return queue;
}

export function clearQueue() {
  saveQueue([]);
}

/** Flush the queue via the provided send function; returns the queue before clearing. */
export function flushQueue(sendBatchFn) {
  const queue = loadQueue();
  if (queue.length === 0) return [];
  sendBatchFn(queue);
  clearQueue();
  return queue;
}
