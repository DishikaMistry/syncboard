const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldApply, resolveOperation, resolveBatch } = require('./resolve');
const { initClock, tick } = require('./hlc');

test('shouldApply: incoming op always applies when field has never been written', () => {
  assert.equal(shouldApply(null, '000000000000001:000000:clientA'), true);
});

test('shouldApply: newer HLC wins over older HLC', () => {
  const older = '000000000001000:000000:clientA';
  const newer = '000000000002000:000000:clientA';
  assert.equal(shouldApply(older, newer), true);
  assert.equal(shouldApply(newer, older), false);
});

test('shouldApply: tie on (wallTime, counter) breaks deterministically on clientId', () => {
  const a = '000000000001000:000000:clientA';
  const b = '000000000001000:000000:clientB';
  // 'clientB' > 'clientA' lexicographically, so b should win over a
  assert.equal(shouldApply(a, b), true);
  assert.equal(shouldApply(b, a), false);
});

test('resolveOperation: applies and returns updated meta when op is newer', () => {
  const card = { field_meta: {} };
  const op = { field: 'title', value: 'Design review', hlc: tick(initClock('c1')), client_id: 'c1' };
  const result = resolveOperation(card, op);
  assert.equal(result.applied, true);
  assert.equal(result.value, 'Design review');
  assert.equal(result.meta.client_id, 'c1');
});

test('resolveOperation: rejects a stale write and leaves state untouched', () => {
  const staleHlc = '000000000001000:000000:c1';
  const freshHlc = '000000000002000:000000:c1';
  const card = { field_meta: { title: { hlc: freshHlc, client_id: 'c1' } } };
  const staleOp = { field: 'title', value: 'old title', hlc: staleHlc, client_id: 'c2' };
  const result = resolveOperation(card, staleOp);
  assert.equal(result.applied, false);
});

test('resolveBatch: two concurrent title edits converge to exactly one winner', () => {
  const card = { field_meta: {} };
  const ops = [
    { field: 'title', value: 'Design Review', hlc: '000000000001000:000000:alice', client_id: 'alice' },
    { field: 'title', value: 'Design Sync', hlc: '000000000001000:000000:bob', client_id: 'bob' },
  ];
  const { finalState, results } = resolveBatch(card, ops);
  // alice's write applies first (field had no prior value); bob's write has a
  // lexicographically greater HLC at the same timestamp, so it overwrites alice's.
  // Final state converges to bob's value regardless of arrival order.
  assert.equal(finalState.title, 'Design Sync');
  assert.equal(results[0].applied, true);
  assert.equal(results[1].applied, true);
});

test('resolveBatch: concurrent move to different lists resolves to one final list_id on all replicas', () => {
  const card = { field_meta: {} };
  const opsOrderA = [
    { field: 'list_id', value: 'list-doing', hlc: '000000000001000:000000:alice', client_id: 'alice' },
    { field: 'list_id', value: 'list-done', hlc: '000000000001500:000000:bob', client_id: 'bob' },
  ];
  const opsOrderB = [...opsOrderA].reverse(); // simulate a different arrival order on another replica

  const resultA = resolveBatch(card, opsOrderA);
  const resultB = resolveBatch(card, opsOrderB);

  // Regardless of arrival order, both replicas converge to the same final list_id.
  assert.equal(resultA.finalState.list_id, 'list-done');
  assert.equal(resultB.finalState.list_id, 'list-done');
});

test('resolveBatch: edits to different fields both survive (no false conflict)', () => {
  const card = { field_meta: {} };
  const ops = [
    { field: 'title', value: 'New title', hlc: '000000000001000:000000:alice', client_id: 'alice' },
    { field: 'list_id', value: 'list-doing', hlc: '000000000001000:000000:bob', client_id: 'bob' },
  ];
  const { finalState } = resolveBatch(card, ops);
  assert.equal(finalState.title, 'New title');
  assert.equal(finalState.list_id, 'list-doing');
});
