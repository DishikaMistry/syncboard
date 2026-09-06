const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

// Get all teams for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, tm.role, tm.joined_at,
        (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) as member_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = $1
      ORDER BY t.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get single team details
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if user is member
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a team member' });
    }
    
    const teamResult = await pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );
    
    const membersResult = await pool.query(
      `SELECT tm.*, u.name, u.email
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at ASC`,
      [teamId]
    );
    
    res.json({
      ...teamResult.rows[0],
      members: membersResult.rows,
      userRole: memberCheck.rows[0].role
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create a new team
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create team
      const teamResult = await client.query(
        `INSERT INTO teams (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING *`,
        [name.trim(), description || '', req.user.userId]
      );
      
      const team = teamResult.rows[0];
      
      // Add creator as owner
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, 'owner')`,
        [team.id, req.user.userId]
      );
      
      await client.query('COMMIT');
      
      res.status(201).json(team);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team
router.patch('/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;
    
    // Check if user is admin or owner
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (memberCheck.rows.length === 0 || 
        !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const result = await pool.query(
      `UPDATE teams 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = now()
      WHERE id = $3
      RETURNING *`,
      [name, description, teamId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team
router.delete('/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if user is owner
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only team owner can delete team' });
    }
    
    await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Invite user to team
router.post('/:teamId/invitations', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, role = 'member' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user is admin or owner
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (memberCheck.rows.length === 0 || 
        !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check if user already in team
    const existingMember = await pool.query(
      `SELECT tm.* FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND u.email = $2`,
      [teamId, email.toLowerCase()]
    );
    
    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a team member' });
    }
    
    // Check for pending invitation
    const pendingInvite = await pool.query(
      `SELECT * FROM team_invitations
      WHERE team_id = $1 AND email = $2 AND status = 'pending'
      AND expires_at > now()`,
      [teamId, email.toLowerCase()]
    );
    
    if (pendingInvite.rows.length > 0) {
      return res.status(400).json({ error: 'Invitation already sent' });
    }
    
    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex');
    
    const result = await pool.query(
      `INSERT INTO team_invitations (team_id, email, invited_by, role, token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [teamId, email.toLowerCase(), req.user.userId, role, token]
    );
    
    // TODO: Send invitation email with token
    // const inviteLink = `${process.env.CLIENT_URL}/invite/${token}`;
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Get pending invitations for a team
router.get('/:teamId/invitations', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if user is member
    const memberCheck = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a team member' });
    }
    
    const result = await pool.query(
      `SELECT ti.*, u.name as invited_by_name
      FROM team_invitations ti
      JOIN users u ON ti.invited_by = u.id
      WHERE ti.team_id = $1
      ORDER BY ti.created_at DESC`,
      [teamId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Accept invitation
router.post('/invitations/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get invitation
      const inviteResult = await client.query(
        `SELECT * FROM team_invitations
        WHERE token = $1 AND status = 'pending' AND expires_at > now()`,
        [token]
      );
      
      if (inviteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      
      const invite = inviteResult.rows[0];
      
      // Check if email matches
      const userResult = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [req.user.userId]
      );
      
      if (userResult.rows[0].email.toLowerCase() !== invite.email.toLowerCase()) {
        return res.status(403).json({ error: 'This invitation is for a different email' });
      }
      
      // Add user to team
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, user_id) DO NOTHING`,
        [invite.team_id, req.user.userId, invite.role]
      );
      
      // Mark invitation as accepted
      await client.query(
        `UPDATE team_invitations SET status = 'accepted' WHERE id = $1`,
        [invite.id]
      );
      
      await client.query('COMMIT');
      
      res.json({ message: 'Invitation accepted', teamId: invite.team_id });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Remove team member
router.delete('/:teamId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    
    // Check if requester is admin or owner
    const requesterRole = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (requesterRole.rows.length === 0 || 
        !['owner', 'admin'].includes(requesterRole.rows[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Check target user role
    const targetRole = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    
    if (targetRole.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a team member' });
    }
    
    // Can't remove owner
    if (targetRole.rows[0].role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove team owner' });
    }
    
    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Update member role
router.patch('/:teamId/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const { role } = req.body;
    
    if (!['member', 'admin', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if requester is owner
    const requesterRole = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.userId]
    );
    
    if (requesterRole.rows.length === 0 || requesterRole.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }
    
    const result = await pool.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3
      RETURNING *`,
      [role, teamId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

module.exports = router;
