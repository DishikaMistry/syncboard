// Client-side mirror of server/src/sync/hlc.js — same algorithm, same encoding,
// so client-generated HLCs compare correctly against server-stored ones.
// (Kept as a duplicate rather than a shared package to avoid monorepo tooling
// overhead for a 2-day build; if this grows, extract to a shared workspace package.)

export function encode({ wallTime, counter, clientId }) {
  return `${String(wallTime).padStart(15, '0')}:${String(counter).padStart(6, '0')}:${clientId}`;
}

export function initClock(clientId) {
  return { wallTime: 0, counter: 0, clientId };
}

export function tick(state) {
  const now = Date.now();
  if (now > state.wallTime) {
    state.wallTime = now;
    state.counter = 0;
  } else {
    state.counter += 1;
  }
  return encode(state);
}
