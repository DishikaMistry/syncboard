import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '../context/TeamContext';
import CreateTeamModal from '../components/CreateTeamModal';
import TeamSettingsModal from '../components/TeamSettingsModal';

export default function TeamsPage() {
  const navigate = useNavigate();
  const { teams, fetchTeams, loading } = useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTeams();
    
    // Auto-refresh every 10 seconds when page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTeams();
      }
    }, 10000);
    
    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTeams();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTeams();
    setRefreshing(false);
  };
  
  // Callback when modal closes - refresh teams
  const handleModalClose = () => {
    setSelectedTeamId(null);
    fetchTeams(); // Refresh to get updated member counts
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Teams</h1>
          <p style={styles.subtitle}>Manage your team workspaces and members</p>
        </div>
        <div style={styles.headerActions}>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            style={{...styles.secondaryButton, opacity: refreshing ? 0.6 : 1}}
          >
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
          <button onClick={() => navigate('/board')} style={styles.secondaryButton}>
            Back to Board
          </button>
          <button onClick={() => setShowCreateModal(true)} style={styles.primaryButton}>
            + Create Team
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading teams...</div>
      ) : teams.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>👥</div>
          <h2 style={styles.emptyTitle}>No Teams Yet</h2>
          <p style={styles.emptyText}>
            Create a team to collaborate with others on shared boards
          </p>
          <button onClick={() => setShowCreateModal(true)} style={styles.emptyButton}>
            Create Your First Team
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onSettings={() => setSelectedTeamId(team.id)}
              onOpen={() => {
                // TODO: Navigate to team's boards
                navigate('/board');
              }}
            />
          ))}
        </div>
      )}

      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          fetchTeams(); // Refresh after creating team
        }}
      />

      <TeamSettingsModal
        isOpen={!!selectedTeamId}
        onClose={handleModalClose}
        teamId={selectedTeamId}
      />
    </div>
  );
}

function TeamCard({ team, onSettings, onOpen }) {
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return '#667eea';
      case 'admin':
        return '#f59e0b';
      case 'member':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.cardTitle}>{team.name}</h3>
          <p style={styles.cardDescription}>
            {team.description || 'No description'}
          </p>
        </div>
        <span
          style={{
            ...styles.roleBadge,
            backgroundColor: getRoleBadgeColor(team.role),
          }}
        >
          {team.role}
        </span>
      </div>

      <div style={styles.cardStats}>
        <div style={styles.stat}>
          <span style={styles.statValue}>{team.member_count}</span>
          <span style={styles.statLabel}>
            {team.member_count === 1 ? 'Member' : 'Members'}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statValue}>
            {new Date(team.created_at).toLocaleDateString()}
          </span>
          <span style={styles.statLabel}>Created</span>
        </div>
      </div>

      <div style={styles.cardActions}>
        <button onClick={onOpen} style={styles.cardButton}>
          Open Boards
        </button>
        <button onClick={onSettings} style={styles.cardSettingsButton}>
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: 40,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    flexWrap: 'wrap',
    gap: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: '0 0 8px',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: 12,
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: 'white',
    color: '#64748b',
    border: '2px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: 60,
    fontSize: 16,
    color: '#64748b',
  },
  empty: {
    textAlign: 'center',
    padding: 80,
    backgroundColor: 'white',
    borderRadius: 16,
    maxWidth: 500,
    margin: '0 auto',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 700,
    margin: '0 0 12px',
    color: '#1e293b',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    margin: '0 0 32px',
    lineHeight: 1.6,
  },
  emptyButton: {
    padding: '14px 32px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #e2e8f0',
    transition: 'box-shadow 0.2s, transform 0.2s',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 8px',
    color: '#1e293b',
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  roleBadge: {
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardStats: {
    display: 'flex',
    gap: 24,
    paddingBottom: 20,
    marginBottom: 20,
    borderBottom: '1px solid #e2e8f0',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardActions: {
    display: 'flex',
    gap: 8,
  },
  cardButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cardSettingsButton: {
    padding: '10px 16px',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
