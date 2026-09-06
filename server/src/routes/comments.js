const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get comments for a card
router.get('/cards/:cardId/comments', authenticateToken, async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as user_name, u.email as user_email 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.card_id = $1 
       ORDER BY c.created_at ASC`,
      [cardId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error('Get comments failed', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Add comment to a card
router.post('/cards/:cardId/comments', authenticateToken, async (req, res) => {
  const { cardId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (card_id, user_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [cardId, userId, content]
    );

    // Get user info
    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const comment = {
      ...result.rows[0],
      user_name: userResult.rows[0].name,
      user_email: userResult.rows[0].email
    };

    res.json({ comment });
  } catch (err) {
    console.error('Add comment failed', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if comment belongs to user
    const check = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (check.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete comment failed', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
