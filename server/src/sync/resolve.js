/**
 * Core conflict-resolution engine — the module the assignment calls out as a
 * "core deliverable." Kept pure and framework-free on purpose: no Express, no
 * Socket.io, no DB client. Just data in, decision out. This is what makes it
 * unit-testable in isolation and safe to reuse from both the socket handler and
 * (if needed) a REST fallback path.
 *
 * Model: each field on a card is an independent Last-Write-Wins Register keyed
 * by a Hybrid Logical Clock (see hlc.js). An incoming operation is applied iff
 * its HLC is strictly greater than the HLC currently stored for that field.
 */

/**
 * @param {string|null} currentHlc - HLC currently stored for this field, or null/undefined
 *   if the field has never been written.
 * @param {string} incomingHlc - HLC on the incoming operation.
 * @returns {boolean} whether the incoming write should overwrite the current value.
 */
function shouldApply(currentHlc, incomingHlc) {
  if (!currentHlc) return true;
  return incomingHlc > currentHlc; // safe because hlc.encode() is lexicographically sortable
}

/**
 * Resolve a single incoming operation against a card's current field_meta.
 *
 * @param {{ field_meta: Record<string, {hlc: string, client_id: string}> }} cardState
 * @param {{ field: string, value: any, hlc: string, client_id: string }} op
 * @returns {{ applied: boolean, field: string, value?: any, meta?: {hlc: string, client_id: string} }}
 */
function resolveOperation(cardState, op) {
  const currentMeta = cardState.field_meta ? cardState.field_meta[op.field] : null;
  const currentHlc = currentMeta ? currentMeta.hlc : null;

  if (shouldApply(currentHlc, op.hlc)) {
    return {
      applied: true,
      field: op.field,
      value: op.value,
      meta: { hlc: op.hlc, client_id: op.client_id },
    };
  }
  return { applied: false, field: op.field };
}

/**
 * Resolve a batch of operations (e.g. a flushed offline queue) against a card's
 * current state, applying them in order and folding each result into the next
 * comparison. Order of ops within the batch does not affect the final result for
 * any single field, since HLC comparison is what decides the winner — this is the
 * convergence property that makes offline replay safe.
 */
function resolveBatch(cardState, ops) {
  let state = {
    ...cardState,
    field_meta: { ...(cardState.field_meta || {}) },
  };
  const results = [];

  for (const op of ops) {
    const result = resolveOperation(state, op);
    results.push(result);
    if (result.applied) {
      state.field_meta[result.field] = result.meta;
      state[result.field] = result.value;
    }
  }

  return { finalState: state, results };
}

module.exports = { shouldApply, resolveOperation, resolveBatch };
