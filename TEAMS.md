# Teams Feature Guide

## Overview

The Teams feature allows multiple users to collaborate on boards together. Teams provide a workspace where members can share boards, manage permissions, and work together in real-time.

## Key Concepts

### Team Structure
- **Team**: A workspace that contains multiple users and boards
- **Members**: Users who belong to a team with specific roles
- **Boards**: Can be assigned to a team, making them accessible to all team members

### Roles

1. **Owner** 
   - Full control over the team
   - Can delete the team
   - Can manage all members and their roles
   - Can create, update, and delete boards
   - Can invite new members

2. **Admin**
   - Can manage team settings
   - Can invite and remove members (except owner)
   - Can create and manage boards
   - Cannot delete the team or change owner's role

3. **Member**
   - Can view and edit boards assigned to the team
   - Can comment on cards
   - Cannot manage team settings or members

## Database Setup

### Run the Migration

After setting up the main schema, run the teams migration:

```bash
# Using Docker
docker exec -i syncboard-pg psql -U postgres -d syncboard < server/src/teams-migration.sql

# Using local PostgreSQL
psql -d syncboard -f server/src/teams-migration.sql
```

### What Gets Created

The migration creates:
- `teams` table - Stores team information
- `team_members` table - Links users to teams with roles
- `team_invitations` table - Manages invitation tokens
- `board_members` table - Optional board-level permissions
- `user_has_board_access()` function - Permission checking

## API Endpoints

### Team Management

#### GET /teams
Get all teams for the current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Engineering Team",
    "description": "Our development team",
    "role": "owner",
    "member_count": 5,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

#### POST /teams
Create a new team.

**Request:**
```json
{
  "name": "Product Team",
  "description": "Product management and design"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Product Team",
  "description": "Product management and design",
  "created_by": "user-uuid",
  "created_at": "2026-01-01T00:00:00Z"
}
```

#### GET /teams/:teamId
Get detailed information about a specific team.

**Response:**
```json
{
  "id": "uuid",
  "name": "Engineering Team",
  "description": "Our development team",
  "members": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "owner",
      "joined_at": "2026-01-01T00:00:00Z"
    }
  ],
  "userRole": "owner"
}
```

#### PATCH /teams/:teamId
Update team information (Admin/Owner only).

**Request:**
```json
{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

#### DELETE /teams/:teamId
Delete a team (Owner only).

### Member Invitations

#### POST /teams/:teamId/invitations
Invite a user to the team (Admin/Owner only).

**Request:**
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Response:**
```json
{
  "id": "invitation-uuid",
  "team_id": "team-uuid",
  "email": "newmember@example.com",
  "role": "member",
  "token": "invitation-token",
  "status": "pending",
  "expires_at": "2026-01-08T00:00:00Z"
}
```

#### GET /teams/:teamId/invitations
Get all invitations for a team.

#### POST /teams/invitations/:token/accept
Accept an invitation using the invite token.

**Response:**
```json
{
  "message": "Invitation accepted",
  "teamId": "team-uuid"
}
```

### Member Management

#### DELETE /teams/:teamId/members/:userId
Remove a member from the team (Admin/Owner only).

#### PATCH /teams/:teamId/members/:userId
Update a member's role (Owner only).

**Request:**
```json
{
  "role": "admin"
}
```

## Usage Flow

### 1. Creating a Team

```javascript
// POST /teams
const response = await fetch('http://localhost:3001/teams', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'My Team',
    description: 'Team description'
  })
});

const team = await response.json();
```

### 2. Inviting Members

```javascript
// POST /teams/:teamId/invitations
const response = await fetch(`http://localhost:3001/teams/${teamId}/invitations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: 'teammate@example.com',
    role: 'member'
  })
});

const invitation = await response.json();
// Share invitation.token with the user
```

### 3. Accepting Invitation

```javascript
// POST /teams/invitations/:token/accept
const response = await fetch(`http://localhost:3001/teams/invitations/${inviteToken}/accept`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
// User is now a team member!
```

### 4. Assigning Board to Team

Update the boards table to link a board to a team:

```sql
UPDATE boards SET team_id = 'team-uuid' WHERE id = 'board-uuid';
```

Or in your API:

```javascript
// In your boards route
router.patch('/:boardId/team', authenticateToken, async (req, res) => {
  const { teamId } = req.body;
  // Verify user has permission
  // Update board's team_id
});
```

## Frontend Integration

### Team Context

Create a team context to manage team state:

```javascript
// context/TeamContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const TeamContext = createContext();

export function TeamProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);

  const fetchTeams = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3001/teams', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setTeams(data);
  };

  const createTeam = async (name, description) => {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:3001/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, description })
    });
    const team = await response.json();
    setTeams([...teams, team]);
    return team;
  };

  const inviteMember = async (teamId, email, role = 'member') => {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:3001/teams/${teamId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, role })
    });
    return await response.json();
  };

  return (
    <TeamContext.Provider value={{ 
      teams, 
      currentTeam, 
      setCurrentTeam,
      fetchTeams,
      createTeam,
      inviteMember
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export const useTeams = () => useContext(TeamContext);
```

### Example Components

```javascript
// components/TeamSelector.jsx
import { useTeams } from '../context/TeamContext';

export default function TeamSelector() {
  const { teams, currentTeam, setCurrentTeam, fetchTeams } = useTeams();

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <select 
      value={currentTeam?.id || ''} 
      onChange={(e) => {
        const team = teams.find(t => t.id === e.target.value);
        setCurrentTeam(team);
      }}
    >
      <option value="">Personal Workspace</option>
      {teams.map(team => (
        <option key={team.id} value={team.id}>
          {team.name} ({team.member_count} members)
        </option>
      ))}
    </select>
  );
}
```

## Security Considerations

1. **Permission Checks**: All team operations verify user roles before allowing actions
2. **Email Validation**: Invitations are tied to specific email addresses
3. **Token Expiration**: Invitation tokens expire after 7 days
4. **Owner Protection**: Team owners cannot be removed; only they can delete teams
5. **Role Hierarchy**: Admins cannot modify owner permissions

## Best Practices

1. **Start Small**: Begin with owner/member roles, add admin later if needed
2. **Clear Naming**: Use descriptive team names that reflect their purpose
3. **Regular Cleanup**: Remove inactive members and expired invitations
4. **Board Organization**: Group related boards under appropriate teams
5. **Communication**: Send invitation links via your preferred communication channel (email, Slack, etc.)

## Next Steps

### Email Integration
Integrate an email service to automatically send invitation emails:

```javascript
// In teams.js after creating invitation
const nodemailer = require('nodemailer');

const inviteLink = `${process.env.CLIENT_URL}/invite/${token}`;
await sendEmail(email, 'Team Invitation', `You've been invited to join ${teamName}. Click here: ${inviteLink}`);
```

### Board-Level Permissions
Use the `board_members` table for granular access control on specific boards.

### Activity Logs
Track team activities for audit purposes.

### Real-time Updates
Use Socket.IO to notify team members of changes in real-time.
