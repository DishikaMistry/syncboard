import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function CardModal({ card, onClose, onTitleChange, onDescriptionChange, onDeleteCard }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localTitle, setLocalTitle] = useState(card.title);
  const [localDescription, setLocalDescription] = useState(card.description || '');
  const { token, user } = useAuth();
  const descriptionTimeoutRef = useRef(null);

  useEffect(() => {
    loadComments();
  }, [card.id]);
  
  useEffect(() => {
    setLocalTitle(card.title);
    setLocalDescription(card.description || '');
  }, [card.title, card.description]);

  const loadComments = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/cards/${card.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/cards/${card.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment })
      });
      const data = await res.json();
      setComments([...comments, data.comment]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await fetch(`${SERVER_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleDeleteCard = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/boards/cards/${card.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        onDeleteCard(card.id);
        onClose();
      } else {
        console.error('Delete failed with status:', res.status);
        alert('Failed to delete card. Please try again.');
      }
    } catch (err) {
      console.error('Failed to delete card', err);
      alert('Failed to delete card. Please try again.');
    }
  };

  const handleDescriptionChange = (newDescription) => {
    setLocalDescription(newDescription);
    
    // Debounce description sync - only send after user stops typing for 500ms
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    
    descriptionTimeoutRef.current = setTimeout(() => {
      console.log('💬 Syncing description change');
      onDescriptionChange(card.id, newDescription);
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 30
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 24, marginRight: 12 }}>📋</span>
            <input
              value={localTitle}
              onChange={(e) => {
                setLocalTitle(e.target.value);
                onTitleChange(card.id, e.target.value);
              }}
              style={{
                flex: 1,
                border: 'none',
                fontSize: 20,
                fontWeight: 600,
                outline: 'none',
                padding: '4px 8px',
                borderRadius: 4
              }}
              onFocus={(e) => e.target.style.background = '#f5f5f5'}
              onBlur={(e) => e.target.style.background = 'transparent'}
            />
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#999',
                padding: '0 8px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Description</h3>
          <textarea
            value={localDescription}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Add a description..."
            style={{
              width: '100%',
              minHeight: 80,
              padding: 12,
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Comments */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Comments</h3>
          
          {/* Comment Form */}
          <form onSubmit={handleAddComment} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#667eea',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              style={{
                padding: '8px 16px',
                background: loading || !newComment.trim() ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: loading || !newComment.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
                marginLeft: 42
              }}
            >
              {loading ? 'Posting...' : 'Post Comment'}
            </button>
          </form>

          {/* Comments List */}
          <div style={{ marginTop: 20 }}>
            {comments.length === 0 ? (
              <p style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    display: 'flex',
                    marginBottom: 16,
                    padding: 12,
                    background: '#f9f9f9',
                    borderRadius: 8
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#667eea',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {comment.user_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 4 }}>
                      <strong style={{ fontSize: 14 }}>{comment.user_name}</strong>
                      <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                      {comment.content}
                    </p>
                    {comment.user_id === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        style={{
                          marginTop: 8,
                          background: 'none',
                          border: 'none',
                          color: '#c33',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delete Card Section */}
        <div style={{ 
          borderTop: '1px solid #ddd', 
          paddingTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: '#c33' }}>Danger Zone</h3>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
              Once you delete a card, there is no going back.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#c33',
                border: '1px solid #c33',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              Delete Card
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCard}
                style={{
                  padding: '8px 16px',
                  background: '#c33',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                Yes, Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
