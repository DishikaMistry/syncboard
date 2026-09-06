import { useEffect } from 'react';
import { useTeams } from '../context/TeamContext';

export default function TeamSelector() {
  const { teams, currentTeam, setCurrentTeam, fetchTeams, loading } = useTeams();

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <div style={styles.container}>
      <label style={styles.label}>Workspace</label>
      <select
        value={currentTeam?.id || ''}
        onChange={(e) => {
          const team = teams.find((t) => t.id === e.target.value);
          setCurrentTeam(team || null);
        }}
        style={styles.select}
        disabled={loading}
      >
        <option value="">Personal Workspace</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.member_count} {team.member_count === 1 ? 'member' : 'members'})
          </option>
        ))}
      </select>
      {currentTeam && (
        <span style={styles.badge}>
          {currentTeam.role}
        </span>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: '#666',
  },
  select: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #ddd',
    fontSize: 14,
    backgroundColor: 'white',
    cursor: 'pointer',
    minWidth: 200,
  },
  badge: {
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: '#667eea',
    color: 'white',
    textTransform: 'capitalize',
  },
};
