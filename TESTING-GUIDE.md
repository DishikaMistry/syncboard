# SyncBoard - Conflict Resolution Testing Guide

This guide demonstrates how to test the conflict resolution system live, proving correctness under adversarial scenarios.

---

## Prerequisites

1. **Two Browser Tabs/Windows** (or browsers)
2. **Server Running**: `cd server && npm run dev`
3. **Client Running**: `cd client && npm run dev`
4. **Chrome DevTools** for network throttling (simulating offline)

---

## Test 1: Basic Concurrent Edit (Same Field)

**Scenario**: Two users edit the same card's title simultaneously while both online.

### Steps:

1. **Setup**:
   - Open two browser tabs: `http://localhost:5173`
   - Tab A: Login as User A
   - Tab B: Login as User B (different account)
   - Both users: Create/join same team → same board

2. **Create Test Card**:
   - Tab A: Create card "Test Conflict"
   - Tab B: Should see the card appear instantly

3. **Concurrent Edit**:
   - Tab A: Click card → Change title to "User A Version"
   - Tab B: **Immediately** click same card → Change title to "User B Version"
   - Both: Save/blur the input

4. **Expected Result**:
   - One version wins (higher HLC timestamp)
   - Both tabs converge to **same final value**
   - Losing user sees toast: "Card updated by another user"

5. **Verify**:
   ```sql
   -- In PostgreSQL
   SELECT * FROM operations 
   WHERE card_id = '<card-id>' 
   AND field = 'title' 
   ORDER BY hlc DESC;
   
   -- You should see:
   -- 2 operations logged
   -- Winner: applied = true
   -- Loser: applied = false
   ```

---

## Test 2: Offline Edit → Reconnect → Conflict

**Scenario**: User A goes offline, edits card. User B edits same card online. User A reconnects.

### Steps:

1. **Setup**:
   - Two tabs, both logged in, same board
   - Create test card "Offline Test"

2. **Disconnect User A**:
   - Tab A: Open DevTools (F12)
   - Tab A: Go to Network tab
   - Tab A: Check "Offline" (or throttle to "Offline")
   - Tab A: Connection status indicator should show **🔴 Offline**

3. **Edit While Offline**:
   - Tab A: Click card → Change title to "Offline Edit"
   - Tab A: Notice optimistic update (appears changed locally)
   - Tab A: Check browser console: Should see operation queued
   - Tab B: Card still shows original title

4. **Edit While User A Offline**:
   - Tab B: Click same card → Change title to "Online Edit"
   - Tab B: Sees change immediately (still connected)

5. **Reconnect User A**:
   - Tab A: Uncheck "Offline" in DevTools
   - Tab A: Connection status changes: 🔴 Offline → 🟠 Syncing → 🟢 Online
   - Watch both tabs!

6. **Expected Result**:
   - User A's queue flushes to server
   - Server resolves conflict based on HLC
   - **If User B's edit happened later**: 
     - Both tabs show "Online Edit"
     - Tab A sees conflict toast
   - **If User A's edit has higher HLC**:
     - Both tabs show "Offline Edit"
     - Tab B sees conflict toast

7. **Verify No Data Loss**:
   ```sql
   SELECT * FROM operations 
   WHERE card_id = '<card-id>' 
   AND field = 'title' 
   ORDER BY received_at;
   
   -- Both operations should be present
   -- Neither is lost
   -- One applied = true, one applied = false
   ```

---

## Test 3: Multiple Offline Edits (Queue Replay)

**Scenario**: User goes offline, makes multiple edits, reconnects.

### Steps:

1. **Setup**:
   - Single tab, logged in
   - Create 3 cards: "Card 1", "Card 2", "Card 3"

2. **Go Offline**:
   - DevTools → Network → Offline
   - Status: 🔴 Offline

3. **Make Multiple Edits**:
   - Edit Card 1 title → "Edited 1"
   - Move Card 2 → Different list
   - Edit Card 3 title → "Edited 3"
   - Delete Card 1

4. **Verify Local Queue**:
   - Open DevTools → Application → Local Storage
   - Find key: `syncboard:op-queue`
   - Should contain array of 4 operations

5. **Refresh Page (While Still Offline)**:
   - Reload the tab
   - Status: 🔴 Offline
   - Check Local Storage again
   - Queue should **still be there** (persisted)

6. **Reconnect**:
   - DevTools → Network → Uncheck Offline
   - Watch server logs: Should see 4 operations processed

7. **Expected Result**:
   - All 4 operations applied
   - Server state matches local state
   - No operations lost
   - Queue cleared after successful sync

---

## Test 4: Simultaneous Card Move (Different Lists)

**Scenario**: Two users move the same card to different lists at exact same time.

### Steps:

1. **Setup**:
   - Two tabs, same board
   - Create card in "To Do" list
   - Ensure 3 lists: "To Do", "In Progress", "Done"

2. **Simultaneous Move**:
   - Tab A: Drag card from "To Do" → "In Progress"
   - Tab B: **At same time** drag same card → "Done"

3. **Expected Result**:
   - One move wins (higher HLC)
   - Both tabs show card in **same final list**
   - Losing user may see card "jump" to different list
   - Conflict toast appears on losing client

4. **Verify Consistency**:
   ```sql
   SELECT list_id, field_meta->'list_id'->>'hlc' as list_hlc
   FROM cards 
   WHERE id = '<card-id>';
   
   -- Should show single list_id
   -- HLC should match the winning operation
   ```

---

## Test 5: Page Refresh During Offline Queue

**Scenario**: Prove queue survives page reload (no data loss).

### Steps:

1. **Setup**:
   - Single tab, logged in
   - Create test card

2. **Go Offline + Edit**:
   - DevTools → Offline
   - Edit card title → "Before Refresh"
   - Check Local Storage: Queue has 1 op

3. **Hard Refresh**:
   - Press Ctrl+Shift+R (clear cache)
   - Page reloads
   - Status: 🔴 Offline (still)

4. **Verify Queue Preserved**:
   - Check Local Storage: `syncboard:op-queue` still present
   - Edit card again → "After Refresh"
   - Queue now has 2 operations

5. **Reconnect**:
   - Uncheck Offline
   - Both operations should sync

6. **Expected Result**:
   - ✅ No data loss
   - ✅ Both edits applied
   - ✅ Queue cleared after sync

---

## Test 6: Network Interruption (Mid-Operation)

**Scenario**: Simulate dropped connection during operation send.

### Steps:

1. **Setup**:
   - Single tab, online
   - Open Network tab in DevTools

2. **Block WebSocket Mid-Operation**:
   - Start editing card title
   - **While typing**, throttle network → Offline
   - Finish typing, blur input

3. **Expected Result**:
   - Operation queued locally
   - Connection status → Offline
   - Edit appears locally (optimistic)

4. **Reconnect**:
   - Restore network
   - Operation syncs from queue

5. **Verify**:
   - Server should have received operation
   - No duplicates (UUID idempotency)

---

## Test 7: Idempotency (Duplicate Send)

**Scenario**: Operation sent twice (e.g., reconnect before ACK).

### Steps:

1. **Setup**:
   - Server logs enabled
   - Single tab, online

2. **Simulate Duplicate**:
   - Edit card title
   - Watch Network tab for WebSocket event `op`
   - Note the operation ID from console logs

3. **Manual Replay** (for testing):
   - Open browser console
   - Get socket instance: `window.socket` (if exposed for testing)
   - Resend same operation:
     ```javascript
     socket.emit('op', {
       id: '<same-uuid>',
       cardId: '<card-id>',
       field: 'title',
       value: 'Test',
       hlc: '<same-hlc>',
       clientId: '<same-client-id>',
       boardId: '<board-id>'
     });
     ```

4. **Expected Result**:
   - Server logs: "Operation already exists, skipping"
   - Database: Only 1 row in `operations` table for that UUID
   - No duplicate application

---

## Test 8: Three-Way Conflict

**Scenario**: Three users edit same field nearly simultaneously.

### Steps:

1. **Setup**:
   - Three tabs, three different users
   - All on same board, same card

2. **Rapid Edits**:
   - Tab A: Change title → "Version A"
   - Tab B: Change title → "Version B" (within 100ms)
   - Tab C: Change title → "Version C" (within 100ms)

3. **Expected Result**:
   - Only **one version** wins
   - All three tabs converge to same value
   - Two users see conflict toast
   - All three operations logged in DB

4. **Verify Determinism**:
   - Repeat test multiple times
   - Winner should be consistent (highest HLC)
   - If HLCs identical (rare), client_id tie-breaker applies

---

## Test 9: Cross-Field Conflict (Should NOT Conflict)

**Scenario**: Two users edit different fields on same card.

### Steps:

1. **Setup**:
   - Two tabs, same board, same card

2. **Different Field Edits**:
   - Tab A: Edit card **title** → "New Title"
   - Tab B: Move card to **different list** (changes `list_id`)

3. **Expected Result**:
   - ✅ Both changes applied
   - ✅ No conflict (different fields)
   - ✅ No toast notification
   - Final state: New title AND new list

4. **Verify**:
   ```sql
   SELECT 
     title, 
     list_id,
     field_meta->'title'->>'hlc' as title_hlc,
     field_meta->'list_id'->>'hlc' as list_hlc
   FROM cards 
   WHERE id = '<card-id>';
   
   -- Should show:
   -- Both fields updated
   -- Different HLCs for different fields
   ```

---

## Test 10: Stress Test (Rapid Operations)

**Scenario**: User rapidly creates/edits multiple cards while flapping online/offline.

### Steps:

1. **Setup**:
   - Single tab, start online

2. **Rapid Actions**:
   - Create 5 cards quickly
   - Go offline
   - Edit all 5 titles
   - Go online (reconnect)
   - Go offline again
   - Delete 2 cards
   - Go online (reconnect)

3. **Expected Result**:
   - All operations eventually sync
   - No data loss
   - No duplicate cards
   - Correct final state

4. **Verify Queue Behavior**:
   - Check console logs for queue flush events
   - Verify operations table has all ops
   - No errors in server logs

---

## Verification Checklist

After running all tests, verify:

### Database Integrity
```sql
-- 1. All operations logged
SELECT COUNT(*) FROM operations;

-- 2. No orphaned data
SELECT COUNT(*) FROM cards WHERE board_id NOT IN (SELECT id FROM boards);

-- 3. Field metadata present
SELECT COUNT(*) FROM cards WHERE field_meta IS NULL OR field_meta = '{}';

-- 4. Applied/rejected ratio makes sense
SELECT applied, COUNT(*) FROM operations GROUP BY applied;
```

### Client State
- [ ] No JavaScript errors in console
- [ ] Queue cleared after successful sync
- [ ] Connection status accurate
- [ ] Optimistic updates work correctly

### Server State
- [ ] No crashes during tests
- [ ] All operations processed
- [ ] Transactions committed properly
- [ ] Socket rooms managed correctly

---

## Expected Behaviors (Summary)

| Scenario | Expected Outcome | Toast? | Data Loss? |
|----------|------------------|--------|------------|
| Same field, both online | One wins (higher HLC) | Yes (loser) | No |
| Different fields, both online | Both applied | No | No |
| Offline edit, then reconnect | Queue flushes, resolves | Maybe | No |
| Page refresh while offline | Queue preserved | No | No |
| Duplicate operation sent | Idempotent (applied once) | No | No |
| Network drop mid-operation | Queued, syncs on reconnect | No | No |
| Three-way conflict | Highest HLC wins | Yes (2 losers) | No |
| Rapid offline edits | All queued, batch sync | Maybe | No |

---

## Debugging Tips

### View Local Queue
```javascript
// Browser console
JSON.parse(localStorage.getItem('syncboard:op-queue'))
```

### Clear Queue (if stuck)
```javascript
localStorage.removeItem('syncboard:op-queue')
```

### Force Reconnect
```javascript
// If socket exposed globally
socket.disconnect()
socket.connect()
```

### Check HLC Ordering
```sql
-- Operations for a specific card, ordered by HLC
SELECT 
  field,
  value,
  hlc,
  client_id,
  applied,
  received_at
FROM operations 
WHERE card_id = '<card-id>'
ORDER BY hlc DESC;
```

### Inspect Card Metadata
```sql
SELECT 
  id,
  title,
  list_id,
  jsonb_pretty(field_meta) as metadata
FROM cards 
WHERE id = '<card-id>';
```

---

## Common Issues & Solutions

### Issue: Toast doesn't appear
**Cause**: HLCs might be identical (rare)  
**Solution**: Check `field_meta` in DB, verify HLC differences

### Issue: Queue not flushing
**Cause**: Socket not reconnecting  
**Solution**: Check server logs, verify `join-board` event

### Issue: Operations appear twice
**Cause**: Missing idempotency check  
**Solution**: Verify `ON CONFLICT (id) DO NOTHING` in SQL

### Issue: Card "jumps" unexpectedly
**Cause**: Normal conflict resolution  
**Solution**: Working as intended, conflict toast should show

---

## Success Criteria

✅ **All tests pass**  
✅ **No data loss in any scenario**  
✅ **Conflicts resolve deterministically**  
✅ **Losing edits logged but not applied**  
✅ **Queue survives page refresh**  
✅ **No duplicate operations**  
✅ **Connection status accurate**  
✅ **Reasonable UX (toast notifications)**

---

## Demo Script (5 Minutes)

For live demonstration:

1. **Setup** (30s):
   - Open two tabs side-by-side
   - Both logged in, same board

2. **Real-Time Sync** (30s):
   - Tab A: Create card
   - Tab B: See it appear instantly
   - Tab B: Move card
   - Tab A: See it move instantly

3. **Conflict Resolution** (1m):
   - Tab A: Go offline (DevTools)
   - Tab A: Edit card title
   - Tab B: Edit same card title
   - Tab A: Reconnect
   - Show: Conflict resolves, toast appears

4. **No Data Loss** (1m):
   - Tab A: Go offline
   - Tab A: Make 3 edits
   - Tab A: Refresh page
   - Tab A: Reconnect
   - Show: All 3 edits sync successfully

5. **Database Proof** (1m):
   - Open PostgreSQL client
   - Query `operations` table
   - Show: All operations logged
   - Show: `applied` column distinguishes winners/losers

6. **Code Walkthrough** (1m):
   - Open `server/src/sync/resolve.js`
   - Show: Pure conflict resolution function
   - Show: HLC comparison logic
   - Explain: Field-level granularity

**Total**: 5 minutes, proves all requirements ✅
