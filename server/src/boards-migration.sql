-- Update boards to support user-specific and team-specific boards

-- Add user_id to boards for personal boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_boards_user ON boards (user_id);
CREATE INDEX IF NOT EXISTS idx_boards_team ON boards (team_id);

-- Function to create a default personal board for a user
CREATE OR REPLACE FUNCTION create_default_board_for_user(user_uuid UUID, user_name TEXT)
RETURNS UUID AS $$
DECLARE
  board_uuid UUID;
  list1_uuid UUID;
  list2_uuid UUID;
  list3_uuid UUID;
BEGIN
  -- Create personal board
  INSERT INTO boards (name, created_by, user_id)
  VALUES (user_name || '''s Board', user_uuid, user_uuid)
  RETURNING id INTO board_uuid;
  
  -- Create default lists
  INSERT INTO lists (board_id, name, position) VALUES (board_uuid, 'To Do', 1) RETURNING id INTO list1_uuid;
  INSERT INTO lists (board_id, name, position) VALUES (board_uuid, 'In Progress', 2) RETURNING id INTO list2_uuid;
  INSERT INTO lists (board_id, name, position) VALUES (board_uuid, 'Done', 3) RETURNING id INTO list3_uuid;
  
  -- Create a welcome card
  INSERT INTO cards (board_id, list_id, title, description, position, created_by, field_meta)
  VALUES (
    board_uuid,
    list1_uuid,
    'Welcome to your board!',
    'This is your personal board. You can create cards, move them between lists, and collaborate with your team.',
    1,
    user_uuid,
    '{}'
  );
  
  RETURN board_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create personal boards for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
  board_uuid UUID;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.name 
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM boards b WHERE b.user_id = u.id
    )
  LOOP
    board_uuid := create_default_board_for_user(user_record.id, user_record.name);
    RAISE NOTICE 'Created board % for user %', board_uuid, user_record.name;
  END LOOP;
END $$;
