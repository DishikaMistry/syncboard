-- SyncBoard schema

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Card',
  description TEXT DEFAULT '',
  position DOUBLE PRECISION NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- per-field HLC + client_id metadata, one entry per mutable field
  -- e.g. {"title": {"hlc": "...", "client_id": "..."}, "list_id": {...}, "position": {...}}
  field_meta JSONB NOT NULL DEFAULT '{}'
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_card ON comments (card_id);

-- Append-only operation log: source of truth for offline sync, dedup, and audit.
CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY,              -- client-generated; enables safe resend/dedup
  card_id UUID NOT NULL,
  board_id UUID NOT NULL,
  field TEXT NOT NULL,              -- 'title' | 'list_id' | 'position' | 'deleted'
  value JSONB NOT NULL,
  hlc TEXT NOT NULL,                -- sortable encoded Hybrid Logical Clock
  client_id TEXT NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operations_card ON operations (card_id);
CREATE INDEX IF NOT EXISTS idx_operations_board ON operations (board_id);

-- Seed a demo user
INSERT INTO users (id, email, password_hash, name) VALUES
  ('00000000-0000-0000-0000-000000000099', 'demo@syncboard.com', '$2b$10$rKvVXZ9H.8qH0qH0qH0qHOEKvVXZ9H.8qH0qH0qH0qHOEKvVXZ9H.', 'Demo User')
ON CONFLICT (id) DO NOTHING;

-- Seed a demo board so the client has something to load on first run.
INSERT INTO boards (id, name, created_by) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Board', '00000000-0000-0000-0000-000000000099')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lists (id, board_id, name, position) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'To Do', 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'In Progress', 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'Done', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (id, board_id, list_id, title, position, created_by, field_meta) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000a1', 'Set up project', 1, '00000000-0000-0000-0000-000000000099', '{}')
ON CONFLICT (id) DO NOTHING;
