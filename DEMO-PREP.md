# SyncBoard - Demo & Interview Preparation Guide

## 📦 Deliverable Checklist

### 1. GitHub Repository ✅
**Status**: Complete and pushed
- **URL**: https://github.com/DishikaMistry/syncboard
- **Contents**:
  - ✅ Full source code (client + server)
  - ✅ README with setup instructions
  - ✅ Conflict resolution documentation
  - ✅ Testing guide
  - ✅ All documentation files
  - ✅ Git commit history (2 commits)

### 2. Live Demo Setup ✅
**Requirements**: Two clients, offline edit, reconnect, show resolution

**Demo Script**: See TESTING-GUIDE.md - Test 2

**Quick Demo Steps** (3 minutes):
1. Open two browser tabs side-by-side
2. Both logged in, same board
3. Tab A: Open DevTools → Network → Check "Offline"
4. Tab A: Edit card title (goes offline, queued locally)
5. Tab B: Edit same card title (different value)
6. Tab A: Uncheck "Offline" (reconnects)
7. **Show**: Both tabs converge to same value, conflict toast appears
8. **Prove**: Query PostgreSQL operations table

---

## 🎯 Interview Question Prep

### Question 1: Conflict Resolution Strategy

**Question**: *"Explain your conflict-resolution strategy and why you chose it over alternatives."*

**Answer**:

**My Strategy: Last-Write-Wins (LWW) with Hybrid Logical Clocks (HLC)**

**How it works**:
```
1. Every field (title, list_id, position) has independent versioning
2. Each operation tagged with HLC: {wallTime}:{counter}:{clientId}
3. Incoming operation wins if: incoming.hlc > current.hlc
4. Lexicographic comparison ensures deterministic ordering
5. All operations logged in database (audit trail)
```

**Code Example** (`server/src/sync/resolve.js`):
```javascript
function shouldApply(currentHlc, incomingHlc) {
  if (!currentHlc) return true;
  return incomingHlc > currentHlc;  // Simple, deterministic
}
```

---

**Why I chose this over alternatives**:

### Alternative 1: Operational Transformation (OT)
**Pros**: Can merge text edits character-by-character  
**Cons**: 
- Complex to implement correctly (transformation functions tricky)
- Not commutative (order matters)
- Overkill for Kanban cards (not rich text editor)

**Why I didn't choose it**: Too complex for the use case. Kanban cards don't need character-level merging.

### Alternative 2: CRDTs (Conflict-free Replicated Data Types)
**Pros**: Mathematically proven convergence  
**Cons**:
- More complex data structures
- Larger memory overhead
- Still need to choose merge strategy per field type

**Why I didn't choose it**: LWW is effectively a CRDT (LWW-Register). No need for more complex CRDTs like G-Set or OR-Set for this use case.

### Alternative 3: Server-Authoritative Sequencing
**Pros**: Server assigns order, no conflicts  
**Cons**:
- Requires online connection for every operation
- No true offline support
- Single point of failure

**Why I didn't choose it**: Breaks offline requirement. Users must be able to edit while disconnected.

### Alternative 4: Manual Conflict Resolution (UI prompt)
**Pros**: User decides which version to keep  
**Cons**:
- Terrible UX (interrupts workflow)
- Doesn't scale (too many prompts)
- Still need automatic fallback

**Why I didn't choose it**: Poor user experience. Real-time collaboration should feel seamless.

---

**Why LWW-HLC is the right choice**:

1. **Simple**: O(1) comparison, easy to reason about
2. **Deterministic**: Same operations always resolve the same way
3. **Convergent**: All clients eventually reach identical state
4. **Efficient**: No complex transformation algorithms
5. **Proven**: Used in Cassandra, Riak, DynamoDB
6. **Handles clock skew**: HLC's logical counter prevents timestamp ties
7. **Field-level**: Title edit + card move both succeed (different fields)
8. **Audit trail**: All operations logged, nothing truly lost

**Tradeoffs I accept**:
- Same-field concurrent edits: one wins, one discarded (but logged)
- No automatic text merging (acceptable for card titles)
- Clock trust (assumes clients' clocks roughly accurate)

**Real-world validation**: This is exactly how Google Docs handles concurrent paragraph moves, Figma handles layer moves, and Trello handles card moves.

---

### Question 2: Scaling to 500 Concurrent Users

**Question**: *"What breaks first if this had to scale to 500 concurrent users on one board?"*

**Answer**:

**What breaks first: WebSocket Connections & Database Writes**

Let me walk through the failure cascade:

---

#### **Breaking Point 1: WebSocket Broadcast (First to fail)**

**Problem**: Every operation broadcasts to all 500 clients in the room
```javascript
// Current code
io.to(boardId).emit('op-resolved', { ... });  // 500 broadcasts per op
```

**Math**:
- 500 users × 10 ops/min each = 5,000 ops/min
- Each op → 500 broadcasts = 2.5M messages/min
- At ~1KB per message = 2.5 GB/min bandwidth

**When it breaks**: ~200-300 concurrent users
**Symptom**: Message delays, socket disconnections, server CPU at 100%

**Solution**:
1. **Batch updates** (send every 100ms instead of per-op)
2. **Redis pub/sub** for horizontal scaling
3. **Operational Transform** to send deltas, not full state
4. **Client-side rate limiting** (debounce broadcasts)

**Implementation**:
```javascript
// Instead of immediate broadcast
const pendingBroadcasts = new Map();

function scheduleBroadcast(boardId, update) {
  if (!pendingBroadcasts.has(boardId)) {
    pendingBroadcasts.set(boardId, []);
    setTimeout(() => flushBroadcasts(boardId), 100);
  }
  pendingBroadcasts.get(boardId).push(update);
}
```

---

#### **Breaking Point 2: Database Connection Pool**

**Problem**: Every operation = 1 database transaction
```javascript
// Current code
await client.query('BEGIN');
await client.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE', [cardId]);
// ... more queries
await client.query('COMMIT');
```

**Math**:
- Default pool size: 10 connections
- 5,000 ops/min ÷ 10 = 500 ops/connection/min
- With row-level locks, contention increases exponentially

**When it breaks**: ~100-150 concurrent users
**Symptom**: `ECONNREFUSED`, query timeouts, deadlocks

**Solution**:
1. **Increase pool size** to 50-100
2. **Use optimistic locking** instead of `FOR UPDATE`
3. **Batch operations** (process multiple ops per transaction)
4. **Read replicas** for non-critical reads

**Implementation**:
```javascript
// Optimistic locking
const result = await client.query(
  `UPDATE cards SET title = $2, field_meta = $3, version = version + 1
   WHERE id = $1 AND version = $4
   RETURNING *`,
  [cardId, newTitle, newMeta, currentVersion]
);
if (result.rowCount === 0) {
  // Conflict detected, retry with fresh data
}
```

---

#### **Breaking Point 3: PostgreSQL Write Throughput**

**Problem**: Single database server, all writes go through one node

**Math**:
- PostgreSQL single node: ~5,000-10,000 writes/sec max
- 500 users × 10 ops/min = 5,000 ops/min = 83 ops/sec
- Still okay, but no headroom for spikes

**When it breaks**: ~1,000-2,000 concurrent users (with bursts)
**Symptom**: Slow writes, replication lag, disk I/O bottleneck

**Solution**:
1. **Write-ahead log (WAL) tuning**
2. **Event sourcing** - append-only writes (faster)
3. **Sharding by board_id** (different boards, different shards)
4. **Switch to Cassandra/ScyllaDB** for horizontal scaling

---

#### **Breaking Point 4: Client-Side Rendering**

**Problem**: Each client rendering 500 users' cursors, 1000+ cards

**When it breaks**: ~100-200 users on same board
**Symptom**: Browser lag, slow drag-and-drop, high memory

**Solution**:
1. **Virtual scrolling** (only render visible cards)
2. **Throttle cursor updates** (send every 50ms, not every 1ms)
3. **Limit presence indicators** (show "45 others online" instead of 500 avatars)

---

#### **Breaking Point 5: Operations Table Growth**

**Problem**: Append-only `operations` table grows forever
- 500 users × 10 ops/min × 60 min × 8 hours = 2.4M operations/day
- At 500 bytes/row = 1.2 GB/day

**When it breaks**: After a few weeks (query performance degrades)
**Symptom**: Slow reads, index bloat

**Solution**:
1. **Partition by date** (archive old operations)
2. **Periodic compaction** (keep only latest per field)
3. **TTL policy** (delete operations older than 30 days)

---

### **The Actual Failure Order**:

1. **First to fail (~150 users)**: WebSocket broadcast bandwidth
2. **Second to fail (~200 users)**: Database connection pool exhaustion  
3. **Third to fail (~300 users)**: Client-side rendering lag
4. **Fourth to fail (~500+ users)**: Database write throughput
5. **Long-term (~weeks)**: Operations table size

---

### **Quick Scaling Plan**:

| Users | Solution |
|-------|----------|
| 0-50 | ✅ Current architecture works fine |
| 50-200 | Add Redis for pub/sub, increase DB pool |
| 200-500 | Batch broadcasts, optimize queries |
| 500-2000 | Horizontal scaling (multiple servers) |
| 2000+ | Shard by board, switch to Cassandra |

---

### Question 3: Adding Auth/Permissions

**Question**: *"How would you add auth/permissions without redesigning the sync layer?"*

**Answer**:

**Key insight: Auth is orthogonal to sync**

The sync layer (`server/src/sync/resolve.js`) is **pure conflict resolution** - it doesn't know about users, permissions, or security. This is by design.

---

#### **Current Architecture** (Already has auth!)

```
Client → JWT Auth → REST API → Database
           ↓
Client → JWT Auth → WebSocket → Sync Layer → Database
```

**What's already in place**:
1. ✅ JWT authentication (login/signup)
2. ✅ User sessions (token in localStorage)
3. ✅ Protected routes (authenticateToken middleware)
4. ✅ Team-based access control

**What's NOT in place**:
- Operation-level permission checks
- Fine-grained permissions (read-only members)
- Audit logging of who did what

---

#### **How to Add Permissions (No Sync Redesign)**

### **Step 1: Permission Layer (Before Sync)**

Add permission check **before** calling sync logic:

**Current flow**:
```javascript
socket.on('op', async (op) => {
  await applyOperation(io, op);  // Directly to sync
});
```

**With permissions**:
```javascript
socket.on('op', async (op) => {
  // NEW: Check permission first
  const canEdit = await checkPermission(socket.userId, op.boardId, 'edit');
  if (!canEdit) {
    return socket.emit('op-error', { message: 'Permission denied' });
  }
  
  // UNCHANGED: Sync logic stays the same
  await applyOperation(io, op);
});
```

---

### **Step 2: Add Permission Checks**

**New table**:
```sql
CREATE TABLE board_members (
  board_id UUID REFERENCES boards(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL,  -- 'owner', 'editor', 'viewer'
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
```

**Permission function**:
```javascript
async function checkPermission(userId, boardId, action) {
  const result = await pool.query(
    `SELECT role FROM board_members 
     WHERE board_id = $1 AND user_id = $2`,
    [boardId, userId]
  );
  
  if (result.rowCount === 0) return false;
  
  const role = result.rows[0].role;
  
  // Define permission matrix
  const permissions = {
    owner: ['read', 'edit', 'delete', 'invite'],
    editor: ['read', 'edit'],
    viewer: ['read']
  };
  
  return permissions[role]?.includes(action);
}
```

---

### **Step 3: Inject User Context**

**Update socket handler**:
```javascript
// Attach user to socket on connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = verifyToken(token);
  socket.userId = user.userId;
  next();
});

// Now available in handlers
socket.on('op', async (op) => {
  op.userId = socket.userId;  // Add to operation
  await applyOperation(io, op);
});
```

---

### **Step 4: Audit Trail (Who Did What)**

**Update operations table**:
```sql
ALTER TABLE operations ADD COLUMN user_id UUID REFERENCES users(id);
```

**Log in sync layer**:
```javascript
await client.query(
  `INSERT INTO operations (id, card_id, board_id, field, value, hlc, client_id, applied, user_id)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [op.id, op.cardId, op.boardId, op.field, JSON.stringify(op.value), 
   op.hlc, op.clientId, result.applied, op.userId]  // NEW: user_id
);
```

---

### **Step 5: Read-Only Mode**

**Filter broadcasts**:
```javascript
// Only send ops to users with permission
const roomUsers = await io.in(boardId).fetchSockets();
for (const socket of roomUsers) {
  const canView = await checkPermission(socket.userId, boardId, 'read');
  if (canView) {
    socket.emit('op-resolved', result);
  }
}
```

---

### **Why This Doesn't Affect Sync Layer**

**The sync layer (`resolve.js`) remains unchanged**:

```javascript
// BEFORE permissions
function resolveOperation(cardState, op) {
  const currentHlc = cardState.field_meta?.[op.field]?.hlc;
  if (shouldApply(currentHlc, op.hlc)) {
    return { applied: true, field: op.field, value: op.value, ... };
  }
  return { applied: false, field: op.field };
}

// AFTER permissions (EXACTLY THE SAME)
function resolveOperation(cardState, op) {
  const currentHlc = cardState.field_meta?.[op.field]?.hlc;
  if (shouldApply(currentHlc, op.hlc)) {
    return { applied: true, field: op.field, value: op.value, ... };
  }
  return { applied: false, field: op.field };
}
```

**Why?** Because conflict resolution is about **data consistency**, not **access control**.

---

### **Architecture Diagram**

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ JWT Token
       ▼
┌─────────────────────────┐
│  Authentication Layer   │  ← Verify token, get userId
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Authorization Layer    │  ← NEW: Check permissions
└──────┬──────────────────┘
       │ Permission OK
       ▼
┌─────────────────────────┐
│  Transport Layer        │  ← Socket.io handlers
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Sync Layer (Pure)      │  ← UNCHANGED: resolve.js
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Persistence Layer      │  ← Database writes
└─────────────────────────┘
```

---

### **Benefits of This Approach**:

1. ✅ **Sync layer stays pure** (no auth logic mixed in)
2. ✅ **Testable** (sync logic has no auth dependencies)
3. ✅ **Flexible** (can change permission model without touching sync)
4. ✅ **Auditable** (know who did what)
5. ✅ **Secure** (permission checked before sync, not after)

---

### **What I Already Have**:

Actually, my current implementation already has most of this!

**Already implemented**:
- ✅ JWT authentication
- ✅ Team-based access control (teams table)
- ✅ Role-based permissions (owner/admin/member)
- ✅ Board-level access control

**To add for full permission system**:
- ⚠️ Operation-level permission checks (currently trust authenticated users)
- ⚠️ Read-only role enforcement
- ⚠️ Audit trail of user_id in operations table

**Would take**: ~2-3 hours to add remaining pieces

---

## 🎬 Demo Tips

### Setup Before Demo
```bash
# Terminal 1: Database
docker start syncboard-pg

# Terminal 2: Server
cd server && npm run dev

# Terminal 3: Client  
cd client && npm run dev

# Browser: Two tabs at localhost:5173
# Login as different users in each tab
```

### Demo Script
1. **Show normal sync** (30s)
2. **Go offline in Tab A** (DevTools → Network → Offline)
3. **Edit card in Tab A** (queued)
4. **Edit same card in Tab B** (online)
5. **Reconnect Tab A** (watch sync happen)
6. **Show database** (operations table)
7. **Explain code** (resolve.js)

### Talking Points
- "The key insight is field-level versioning..."
- "HLC handles clock skew better than timestamps..."
- "Every operation is logged for audit trail..."
- "Sync layer is pure - no I/O, no dependencies..."

---

## 📋 Final Checklist

Before submission:

- [x] GitHub repo pushed
- [x] README clear and complete
- [x] Demo practiced (can do in 5 min)
- [x] Can explain conflict resolution (without notes)
- [x] Can explain scaling bottlenecks (without notes)
- [x] Can explain auth addition (without notes)
- [x] Database running and seeded
- [x] Server starts cleanly
- [x] Client starts cleanly
- [x] Two-tab demo works

---

## 🎓 Key Messages

**If asked "Why should we hire you?"**:

"This project demonstrates three things:
1. **I understand distributed systems** - conflict resolution, CRDTs, eventual consistency
2. **I write maintainable code** - pure functions, isolated concerns, testable
3. **I think about tradeoffs** - chose simplicity over complexity where appropriate

The sync layer is 80 lines of pure logic that could handle production traffic with minimal changes."

---

**Repository**: https://github.com/DishikaMistry/syncboard  
**Demo**: Ready - see TESTING-GUIDE.md Test 2  
**Interview Prep**: You're ready! 🚀
