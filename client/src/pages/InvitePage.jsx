import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTeams } from '../context/TeamContext';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { acceptInvitation } = useTeams();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    
    try {
      await acceptInvitation(token);
      setSuccess(true);
      setTimeout(() => {
        navigate('/teams');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Not logged in - show login button
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.icon}>👥</div>
            <h1 style={styles.title}>Team Invitation</h1>
            <p style={styles.subtitle}>
              You've been invited to join a team on SyncBoard!
            </p>
          </div>
          
          <div style={{
            background: '#f0f7ff',
            padding: '16px',
            borderRadius: 8,
            marginBottom: 24,
            border: '1px solid #d0e7ff'
          }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333' }}>
              Please log in or create an account to accept this invitation.
            </p>
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => navigate(`/login?redirect=/invite/${token}`)}
              style={styles.acceptButton}
            >
              Log In to Accept
            </button>
            <button
              onClick={() => navigate('/')}
              style={styles.declineButton}
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Successfully accepted
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Welcome to the Team!</h1>
          <p style={styles.subtitle}>You've successfully joined the team.</p>
          <p style={styles.info}>Redirecting to teams page...</p>
        </div>
      </div>
    );
  }

  // Logged in - show accept button
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.icon}>👥</div>
          <h1 style={styles.title}>You've Been Invited!</h1>
          <p style={styles.subtitle}>
            You've been invited to join a team on SyncBoard
          </p>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.actions}>
          <button
            onClick={handleAccept}
            disabled={loading}
            style={styles.acceptButton}
          >
            {loading ? 'Accepting...' : 'Accept Invitation'}
          </button>
          <button
            onClick={() => navigate('/teams')}
            style={styles.declineButton}
          >
            Maybe Later
          </button>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            By accepting, you'll be able to collaborate with your team members
            on shared boards in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 24,
  },
  card: {
    background: 'white',
    borderRadius: 16,
    padding: 48,
    maxWidth: 500,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  },
  header: {
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#4ade80',
    color: 'white',
    fontSize: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    margin: '0 0 12px',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    margin: 0,
  },
  info: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 14,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  acceptButton: {
    padding: '14px 32px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  declineButton: {
    padding: '14px 32px',
    background: 'transparent',
    color: '#666',
    border: '2px solid #ddd',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  footer: {
    borderTop: '1px solid #eee',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    margin: 0,
    lineHeight: 1.6,
  },
};
