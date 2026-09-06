const { pool } = require('../db');
const { resolveOperation } = require('../sync/resolve');

/**
 * Registers all board-related Socket.io event handlers on a single connected socket.
 * Kept separate from resolve.js on purpose: this file deals with transport + persistence,
 * resolve.js deals with pure decision logic. Don't merge them back together.
 */
function registerBoardHandlers(io, socket) {
  socket.on('join-board', ({ boardId }) => {
    socket.join(boardId);
  });

  // op: { id, cardId, boardId, field, value, hlc, clientId }
  socket.on('op', async (op) => {
    try {
      await applyOperation(io, op);
    } catch (err) {
      console.error('Failed to apply op', op, err);
      socket.emit('op-error', { opId: op.id, message: 'Failed to apply operation' });
    }
  });

  // Flush of an offline queue on reconnect — same handling, just plural.
  socket.on('op-batch', async ({ ops }) => {
    for (const op of ops) {
      try {
        await applyOperation(io, op);
      } catch (err) {
        console.error('Failed to apply queued op', op, err);
      }
    }
  });

  // New card creation event
  socket.on('card-created', async ({ card, boardId }) => {
    // Broadcast to all clients in the room EXCEPT the sender
    socket.to(boardId).emit('card-created', { card });
  });

  // Card deletion event
  socket.on('card-deleted', async ({ cardId, boardId }) => {
    // Broadcast to all clients in the room EXCEPT the sender
    socket.to(boardId).emit('card-deleted', { cardId });
  });
}

async function applyOperation(io, op) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency: if we've already seen this op id (resent after a lost ack),
    // do nothing. This is what makes offline-queue resend safe.
    const existing = await client.query('SELECT 1 FROM operations WHERE id = $1', [op.id]);
    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      return;
    }

    const cardRes = await client.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE', [op.cardId]);
    if (cardRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }
    const card = cardRes.rows[0];

    const result = resolveOperation(card, {
      field: op.field,
      value: op.value,
      hlc: op.hlc,
      client_id: op.clientId,
    });

    await client.query(
      `INSERT INTO operations (id, card_id, board_id, field, value, hlc, client_id, applied)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [op.id, op.cardId, op.boardId, op.field, JSON.stringify(op.value), op.hlc, op.clientId, result.applied]
    );

    if (result.applied) {
      const newFieldMeta = { ...card.field_meta, [result.field]: result.meta };
      await client.query(
        `UPDATE cards SET ${op.field === 'deleted' ? 'deleted' : op.field} = $1, field_meta = $2 WHERE id = $3`,
        [result.value, JSON.stringify(newFieldMeta), op.cardId]
      );
    }

    await client.query('COMMIT');

    // Broadcast the RESOLVED value (not necessarily the sender's proposed value) to
    // every client in the room, including the sender — this is what lets a client
    // detect "the server resolved this differently than what I optimistically applied"
    // and show the conflict toast.
    io.to(op.boardId).emit('op-resolved', {
      opId: op.id,
      cardId: op.cardId,
      field: op.field,
      value: result.applied ? result.value : card[op.field],
      applied: result.applied,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { registerBoardHandlers };
