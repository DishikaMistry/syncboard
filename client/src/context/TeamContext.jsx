import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const TeamContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function TeamProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  const getAuthHeader = () => {
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch all teams for the current user
  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams`, {
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      
      const data = await response.json();
      setTeams(data);
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching teams:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch single team details
  const fetchTeamDetails = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch team details');
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      console.error('Error fetching team details:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Create a new team
  const createTeam = async (name, description = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ name, description }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create team');
      }
      
      const team = await response.json();
      setTeams([...teams, { ...team, role: 'owner', member_count: '1' }]);
      return team;
    } catch (err) {
      setError(err.message);
      console.error('Error creating team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update team
  const updateTeam = async (teamId, updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update team');
      }
      
      const updatedTeam = await response.json();
      setTeams(teams.map(t => t.id === teamId ? { ...t, ...updatedTeam } : t));
      
      if (currentTeam?.id === teamId) {
        setCurrentTeam({ ...currentTeam, ...updatedTeam });
      }
      
      return updatedTeam;
    } catch (err) {
      setError(err.message);
      console.error('Error updating team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete team
  const deleteTeam = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete team');
      }
      
      setTeams(teams.filter(t => t.id !== teamId));
      
      if (currentTeam?.id === teamId) {
        setCurrentTeam(null);
      }
      
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error deleting team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Invite member to team
  const inviteMember = async (teamId, email, role = 'member') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ email, role }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite member');
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      console.error('Error inviting member:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get team invitations
  const fetchInvitations = async (teamId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}/invitations`, {
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      console.error('Error fetching invitations:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Accept invitation
  const acceptInvitation = async (token) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/invitations/${token}/accept`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }
      
      const result = await response.json();
      await fetchTeams(); // Refresh teams list
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Error accepting invitation:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Remove team member
  const removeMember = async (teamId, userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }
      
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error removing member:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update member role
  const updateMemberRole = async (teamId, userId, role) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ role }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      console.error('Error updating member role:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeamContext.Provider
      value={{
        teams,
        currentTeam,
        setCurrentTeam,
        loading,
        error,
        fetchTeams,
        fetchTeamDetails,
        createTeam,
        updateTeam,
        deleteTeam,
        inviteMember,
        fetchInvitations,
        acceptInvitation,
        removeMember,
        updateMemberRole,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export const useTeams = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamProvider');
  }
  return context;
};
