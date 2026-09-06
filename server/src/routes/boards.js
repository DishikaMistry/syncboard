const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// GET /boards — get all boards for current user (personal + team boards)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get personal boards
    const personalBoards = await pool.query(
      `SELECT b.*, 'personal' as type 
       FROM boards b 
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    // Get team boards
    const teamBoards = await pool.query(
      `SELECT DISTINCT b.*, 'team' as type, t.name as team_name
       FROM boards b
       JOIN teams t ON b.team_id = t.id
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    res.json({
      personal: personalBoards.rows,
      team: teamBoards.rows,
      all: [...personalBoards.rows, ...teamBoards.rows]
    });
  } catch (err) {
    console.error('GET /boards failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /boards/user/:userId — get user's personal board
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if requesting own board or has team access
    if (req.user.userId !== userId) {
      // TODO: Check if users share a team
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const board = await pool.query(
      'SELECT * FROM boards WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (board.rowCount === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    const boardId = board.rows[0].id;
    const lists = await pool.query(
      'SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );
    const cards = await pool.query(
      'SELECT * FROM cards WHERE board_id = $1 AND deleted = false ORDER BY position ASC',
      [boardId]
    );

    res.json({ board: board.rows[0], lists: lists.rows, cards: cards.rows });
  } catch (err) {
    console.error('GET /boards/user/:userId failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /boards/team/:teamId — get team's board  
router.get('/team/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;
    
    // Check if user is team member
    const memberCheck = await pool.query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    
    if (memberCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Not a team member' });
    }
    
    // Get or create team board
    let board = await pool.query(
      'SELECT * FROM boards WHERE team_id = $1 LIMIT 1',
      [teamId]
    );
    
    if (board.rowCount === 0) {
      // Create default board for team
      const teamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
      const teamName = teamResult.rows[0].name;
      
      board = await pool.query(
        `INSERT INTO boards (name, team_id, created_by) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [`${teamName} Board`, teamId, userId]
      );
      
      const boardId = board.rows[0].id;
      
      // Create default lists
      await pool.query(
        `INSERT INTO lists (board_id, name, position) VALUES 
         ($1, 'To Do', 1),
         ($1, 'In Progress', 2),
         ($1, 'Done', 3)`,
        [boardId]
      );
    }
    
    const boardId = board.rows[0].id;
    const lists = await pool.query(
      'SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC',
      [boardId]
    );
    const cards = await pool.query(
      'SELECT * FROM cards WHERE board_id = $1 AND deleted = false ORDER BY position ASC',
      [boardId]
    );

    res.json({ board: board.rows[0], lists: lists.rows, cards: cards.rows });
  } catch (err) {
    console.error('GET /boards/team/:teamId failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /boards/:id — full current state, used for initial load and post-reconnect resync.
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const board = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
    if (board.rowCount === 0) return res.status(404).json({ error: 'Board not found' });

    const lists = await pool.query(
      'SELECT * FROM lists WHERE board_id = $1 ORDER BY position ASC',
      [id]
    );
    const cards = await pool.query(
      'SELECT * FROM cards WHERE board_id = $1 AND deleted = false ORDER BY position ASC',
      [id]
    );

    res.json({ board: board.rows[0], lists: lists.rows, cards: cards.rows });
  } catch (err) {
    console.error('GET /boards/:id failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /boards/:id/cards — create a new card
router.post('/:id/cards', async (req, res) => {
  const { id: boardId } = req.params;
  const { listId, title = 'Untitled Card', position } = req.body;
  
  try {
    // Calculate position if not provided (add to end of list)
    let cardPosition = position;
    if (cardPosition === undefined) {
      const lastCard = await pool.query(
        'SELECT position FROM cards WHERE list_id = $1 AND deleted = false ORDER BY position DESC LIMIT 1',
        [listId]
      );
      cardPosition = lastCard.rowCount > 0 ? lastCard.rows[0].position + 1 : 1;
    }

    const result = await pool.query(
      `INSERT INTO cards (board_id, list_id, title, position) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [boardId, listId, title, cardPosition]
    );

    res.json({ card: result.rows[0] });
  } catch (err) {
    console.error('POST /boards/:id/cards failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /cards/:id — delete a card permanently
router.delete('/cards/:id', async (req, res) => {
  const { id: cardId } = req.params;
  
  try {
    // Delete the card and all related data (comments will cascade delete)
    const result = await pool.query('DELETE FROM cards WHERE id = $1 RETURNING *', [cardId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ success: true, cardId });
  } catch (err) {
    console.error('DELETE /cards/:id failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
