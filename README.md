# SyncBoard

A real-time, multi-user Kanban board with authentication that stays correct offline and under concurrent edits.

## Features

- 🔐 **User Authentication** - Secure login/signup with JWT tokens
- 📋 **Multiple Boards** - Create and manage multiple Kanban boards
- 🎴 **Rich Cards** - Cards with titles, descriptions, and comments
- 🔄 **Real-time Sync** - Live updates across all connected clients
- 📴 **Offline Support** - Queue operations locally and sync when reconnected
- 🤝 **Conflict Resolution** - Field-level last-write-wins using Hybrid Logical Clocks
- 💬 **Comments** - Collaborate with threaded comments on cards

## Structure

```
syncboard/
  server/   Express + Socket.io + PostgreSQL
  client/   React (Vite) frontend
```

## Setup

### 1. Database
```bash
# Start PostgreSQL container
docker run --name syncboard-pg -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres

# Create database and run schema
docker exec -i syncboard-pg psql -U postgres -c "CREATE DATABASE syncboard;"
docker exec -i syncboard-pg psql -U postgres -d syncboard < server/src/schema.sql
```

Or if using local PostgreSQL:
```bash
createdb syncboard
psql -d syncboard -f server/src/schema.sql
```

### 2. Server
```bash
cd server
npm install
cp .env.example .env   # edit if needed (see Environment Variables below)
npm run dev
```

**Default Environment Variables:**
- `DATABASE_URL`: `postgresql://postgres:devpass@localhost:5432/syncboard`
- `JWT_SECRET`: Generate a secure random string for production
- `PORT`: `3001`

### 3. Client
```bash
cd client
npm install
cp .env.example .env   # edit VITE_API_URL if server is not on localhost:3001
npm run dev
```

### 4. Login
Open two browser tabs at the printed localhost URL (usually `http://localhost:5173`).

**Demo credentials** (seeded by schema.sql):
- Email: `demo@syncboard.com`
- Password: Check the seeded password hash or create your own user via signup

Open multiple tabs or browsers to test real-time multi-client sync!

## Conflict-resolution model (plain language)

Every editable field on a card (`title`, `list_id`, `position`) is treated as an
independent **Last-Write-Wins Register**, tagged with a **Hybrid Logical Clock (HLC)**
instead of a plain timestamp.

- **Why field-level, not whole-card:** editing a title and moving a card at the same
  time shouldn't clobber each other — each field converges independently.
- **Why HLC instead of `Date.now()`:** HLCs combine a logical counter with wall-clock
  time, so two clients with slightly skewed clocks still get a consistent, causally
  correct ordering. Ties are broken by client ID, so the result is 100% deterministic.
- **How offline works:** while offline, ops are queued locally (and persisted to
  `localStorage` so a refresh doesn't lose them). On reconnect, the queue is flushed to
  the server; the server applies each op through the same LWW comparison it uses for
  live ops, then broadcasts the resolved state to every connected client.
- **How duplicate/dropped acks are handled:** every operation has a client-generated
  UUID. The server inserts operations with `ON CONFLICT (id) DO NOTHING`, so resending
  an op after a lost ack is always safe — it can never be applied twice.

### Known limitations
- **Same-field concurrent edits:** if two users edit a card's *title* at the exact same
  moment, one write wins and the other is silently discarded (not merged). The losing
  op is still preserved in the `operations` audit log, but there's no automatic
  three-way merge or "keep both" UI.
- **Clock trust:** HLCs assume no client's clock is adversarially wrong by a large
  margin. Fine for this use case; would need server-authoritative sequencing for a
  security-sensitive system.
- **Snapshot-based resync:** on reconnect, the client re-fetches the full board state
  rather than a computed delta. Simple and correct, but not bandwidth-efficient for
  very large boards.
