/**
 * Hybrid Logical Clock (HLC) — Kulkarni et al.
 *
 * Combines a logical counter with wall-clock time so causally-ordered events stay
 * ordered even when clients' physical clocks are skewed. Encoded as a zero-padded,
 * lexicographically-sortable string: "<wallTime>:<counter>:<clientId>" — so plain
 * string comparison (`a > b`) is a correct HLC comparison, and equal (wallTime,
 * counter) pairs are broken deterministically by clientId.
 */

function encode({ wallTime, counter, clientId }) {
  return `${String(wallTime).padStart(15, '0')}:${String(counter).padStart(6, '0')}:${clientId}`;
}

function decode(hlcString) {
  const [wallTime, counter, clientId] = hlcString.split(':');
  return { wallTime: Number(wallTime), counter: Number(counter), clientId };
}

/** Create a fresh clock state for a new client session. */
function initClock(clientId) {
  return { wallTime: 0, counter: 0, clientId };
}

/** Advance the local clock for a new local event (e.g. a user edits a card). */
function tick(state) {
  const now = Date.now();
  if (now > state.wallTime) {
    state.wallTime = now;
    state.counter = 0;
  } else {
    state.counter += 1;
  }
  return encode(state);
}

/** Merge in a remote HLC (e.g. an op received from another client/server). */
function receive(state, remoteHlcString) {
  const remote = decode(remoteHlcString);
  const now = Date.now();
  const newWallTime = Math.max(now, state.wallTime, remote.wallTime);

  let newCounter;
  if (newWallTime === state.wallTime && newWallTime === remote.wallTime) {
    newCounter = Math.max(state.counter, remote.counter) + 1;
  } else if (newWallTime === state.wallTime) {
    newCounter = state.counter + 1;
  } else if (newWallTime === remote.wallTime) {
    newCounter = remote.counter + 1;
  } else {
    newCounter = 0;
  }

  state.wallTime = newWallTime;
  state.counter = newCounter;
  return encode(state);
}

module.exports = { encode, decode, initClock, tick, receive };
