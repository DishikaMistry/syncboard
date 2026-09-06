-- Teams Feature Migration
-- Run this after schema.sql to add team functionality

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team members with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- Team invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL, -- unique invite token
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations (team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations (email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations (token);

-- Add team_id to boards to link boards to teams
ALTER TABLE boards ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Board members for granular board-level access control
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member', 'viewer'
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members (board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members (user_id);

-- Function to check if user has access to a board
CREATE OR REPLACE FUNCTION user_has_board_access(check_user_id UUID, check_board_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is board creator
  IF EXISTS (
    SELECT 1 FROM boards WHERE id = check_board_id AND created_by = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is directly added to board
  IF EXISTS (
    SELECT 1 FROM board_members WHERE board_id = check_board_id AND user_id = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is member of board's team
  IF EXISTS (
    SELECT 1 FROM boards b
    JOIN team_members tm ON b.team_id = tm.team_id
    WHERE b.id = check_board_id AND tm.user_id = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
