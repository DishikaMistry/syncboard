import { useState, useEffect } from 'react';
import { useTeams } from '../context/TeamContext';

export default function TeamSettingsModal({ isOpen, onClose, teamId }) {
  const [activeTab, setActiveTab] = useState('general');
  const [teamDetails, setTeamDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { fetchTeamDetails } = useTeams();

  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamDetails();
    }
  }, [isOpen, teamId]);

  const loadTeamDetails = async () => {
    setLoading(true);
    const details = await fetchTeamDetails(teamId);
    setTeamDetails(details);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Team Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('general')}
            style={{
              ...styles.tab,
              ...(activeTab === 'general' ? styles.activeTab : {}),
            }}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('members')}
            style={{
              ...styles.tab,
              ...(activeTab === 'members' ? styles.activeTab : {}),
            }}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            style={{
              ...styles.tab,
              ...(activeTab === 'invitations' ? styles.activeTab : {}),
            }}
          >
            Invitations
          </button>
        </div>

        <div style={styles.content}>
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <>
              {activeTab === 'general' && (
                <GeneralTab teamDetails={teamDetails} onUpdate={loadTeamDetails} />
              )}
              {activeTab === 'members' && (
                <MembersTab teamDetails={teamDetails} onUpdate={loadTeamDetails} />
              )}
              {activeTab === 'invitations' && (
                <InvitationsTab teamId={teamId} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ teamDetails, onUpdate }) {
  const [name, setName] = useState(teamDetails?.name || '');
  const [description, setDescription] = useState(teamDetails?.description || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { updateTeam, deleteTeam } = useTeams();
  const isOwner = teamDetails?.userRole === 'owner';
  const canEdit = isOwner || teamDetails?.userRole === 'admin';

  useEffect(() => {
    setName(teamDetails?.name || '');
    setDescription(teamDetails?.description || '');
  }, [teamDetails]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await updateTeam(teamDetails.id, { name: name.trim(), description: description.trim() });
      setSuccess('Team updated successfully!');
      onUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteTeam(teamDetails.id);
      window.location.reload(); // Refresh the page
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <form onSubmit={handleUpdate}>
        <div style={styles.field}>
          <label style={styles.label}>Team Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            disabled={!canEdit || isSubmitting}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            disabled={!canEdit || isSubmitting}
            rows={3}
          />
        </div>

        {canEdit && (
          <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </form>

      {isOwner && (
        <div style={styles.dangerZone}>
          <h3 style={styles.dangerTitle}>Danger Zone</h3>
          <p style={styles.dangerText}>
            Deleting this team will remove all members and cannot be undone.
          </p>
          <button onClick={handleDelete} style={styles.dangerButton}>
            Delete Team
          </button>
        </div>
      )}
    </div>
  );
}

function MembersTab({ teamDetails, onUpdate }) {
  const { removeMember, updateMemberRole } = useTeams();
  const [error, setError] = useState('');
  const canManage = ['owner', 'admin'].includes(teamDetails?.userRole);

  const handleRemove = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }
    
    try {
      await removeMember(teamDetails.id, userId);
      onUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateMemberRole(teamDetails.id, userId, newRole);
      onUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      
      <div style={styles.membersList}>
        {teamDetails?.members?.map((member) => (
          <div key={member.id} style={styles.memberItem}>
            <div style={styles.memberInfo}>
              <div style={styles.memberName}>{member.name}</div>
              <div style={styles.memberEmail}>{member.email}</div>
            </div>
            
            <div style={styles.memberActions}>
              {teamDetails.userRole === 'owner' && member.role !== 'owner' ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                  style={styles.roleSelect}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              ) : (
                <span style={styles.roleBadge}>{member.role}</span>
              )}
              
              {canManage && member.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(member.user_id)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitationsTab({ teamId }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { inviteMember, fetchInvitations } = useTeams();

  useEffect(() => {
    loadInvitations();
  }, [teamId]);

  const loadInvitations = async () => {
    const data = await fetchInvitations(teamId);
    setInvitations(data);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await inviteMember(teamId, email.trim(), role);
      setEmail('');
      setSuccess('Invitation sent successfully!');
      loadInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteLink = (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied to clipboard!');
  };

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <form onSubmit={handleInvite} style={styles.inviteForm}>
        <div style={styles.field}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@example.com"
            style={styles.input}
            disabled={isSubmitting}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={styles.input}
            disabled={isSubmitting}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>

      <div style={styles.invitationsList}>
        <h3 style={styles.listTitle}>Pending Invitations</h3>
        {invitations.filter(inv => inv.status === 'pending').length === 0 ? (
          <p style={styles.emptyText}>No pending invitations</p>
        ) : (
          invitations
            .filter(inv => inv.status === 'pending')
            .map((invitation) => (
              <div key={invitation.id} style={styles.invitationItem}>
                <div>
                  <div style={styles.invitationEmail}>{invitation.email}</div>
                  <div style={styles.invitationMeta}>
                    Role: {invitation.role} • Invited by {invitation.invited_by_name}
                  </div>
                  <div style={styles.invitationExpiry}>
                    Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => copyInviteLink(invitation.token)}
                  style={styles.copyButton}
                >
                  Copy Link
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 700,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottom: '1px solid #eee',
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: 32,
    cursor: 'pointer',
    color: '#999',
    padding: 0,
    width: 32,
    height: 32,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #eee',
    padding: '0 24px',
  },
  tab: {
    padding: '12px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#666',
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: '#667eea',
    borderBottomColor: '#667eea',
  },
  content: {
    padding: 24,
    overflowY: 'auto',
    flex: 1,
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  success: {
    backgroundColor: '#efe',
    color: '#3c3',
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  primaryButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#667eea',
    color: 'white',
  },
  dangerZone: {
    marginTop: 40,
    padding: 20,
    border: '2px solid #fee',
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  dangerTitle: {
    margin: '0 0 8px',
    fontSize: 16,
    fontWeight: 700,
    color: '#c33',
  },
  dangerText: {
    margin: '0 0 16px',
    fontSize: 14,
    color: '#666',
  },
  dangerButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: '#c33',
    color: 'white',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  memberItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    border: '1px solid #eee',
    borderRadius: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#333',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: '#666',
  },
  memberActions: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  roleSelect: {
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: 13,
  },
  roleBadge: {
    padding: '6px 12px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: '#667eea',
    color: 'white',
    textTransform: 'capitalize',
  },
  removeButton: {
    padding: '6px 12px',
    border: '1px solid #fee',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    backgroundColor: '#fee',
    color: '#c33',
  },
  inviteForm: {
    marginBottom: 32,
    paddingBottom: 32,
    borderBottom: '1px solid #eee',
  },
  invitationsList: {
    marginTop: 24,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 20,
  },
  invitationItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    border: '1px solid #eee',
    borderRadius: 8,
    marginBottom: 12,
  },
  invitationEmail: {
    fontSize: 15,
    fontWeight: 600,
    color: '#333',
    marginBottom: 4,
  },
  invitationMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  invitationExpiry: {
    fontSize: 12,
    color: '#999',
  },
  copyButton: {
    padding: '8px 16px',
    border: '1px solid #667eea',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    backgroundColor: 'white',
    color: '#667eea',
    fontWeight: 600,
  },
};
