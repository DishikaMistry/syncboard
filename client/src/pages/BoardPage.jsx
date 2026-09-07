import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { createSocket } from '../api/socket';
import { boardReducer, initialState } from '../state/boardReducer';
import { initClock, tick } from '../sync/hlc';
import { enqueueOp, flushQueue } from '../sync/opQueue';
import Board from '../components/Board';
import ConnectionStatus from '../components/ConnectionStatus';
import ConflictToast from '../components/ConflictToast';
import CardModal from '../components/CardModal';
import TeamSelector from '../components/TeamSelector';
import { useAuth } from '../context/AuthContext';
import { useTeams } from '../context/TeamContext';

const BOARD_ID = import.meta.env.VITE_BOARD_ID || '00000000-0000-0000-0000-000000000001';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const CLIENT_ID = (() => {
  const existing = localStorage.getItem('syncboard:client-id');
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem('syncboard:client-id', id);
  return id;
})();

export default function BoardPage() {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  const [toast, setToast] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const socketRef = useRef(null);
  const clockRef = useRef(initClock(CLIENT_ID));
  const { user, logout, token } = useAuth();
  const { currentTeam } = useTeams();
  const navigate = useNavigate();

  // Send an op: apply optimistically, then either emit live or queue for later.
  function sendOp(field, cardId, value) {
    if (!currentBoardId) return;
    
    const op = {
      id: uuid(),
      cardId,
      boardId: currentBoardId,
      field,
      value,
      hlc: tick(clockRef.current),
      clientId: CLIENT_ID,
    };

    console.log(`📝 sendOp called - field: ${field}, value:`, value);
    console.log(`   Socket exists: ${!!socketRef.current}, Connected: ${socketRef.current?.connected}`);

    dispatch({ type: 'OPTIMISTIC_UPDATE', cardId, field, value });

    if (socketRef.current && socketRef.current.connected) {
      console.log('🟢 Online: Sending op immediately', op);
      socketRef.current.emit('op', op);
    } else {
      console.log('🔴 Offline: Queueing op for later', op);
      const queue = enqueueOp(op);
      console.log(`   Queue now has ${queue.length} operations`);
    }
  }

  const onTitleChange = (cardId, title) => sendOp('title', cardId, title);
  const onDescriptionChange = (cardId, description) => sendOp('description', cardId, description);
  const onCardMove = (cardId, targetListId) => sendOp('list_id', cardId, targetListId);
  
  const onDeleteCard = (cardId) => {
    if (!currentBoardId) return;
    
    // Remove from local state
    dispatch({ type: 'DELETE_CARD', cardId });
    
    // Broadcast to other clients
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('card-deleted', { cardId, boardId: currentBoardId });
    }
  };

  const onAddCard = async (listId) => {
    if (!currentBoardId) return;
    
    // Check if offline
    if (!socketRef.current?.connected) {
      console.log('⚠️ Cannot create cards while offline');
      alert('You are offline. Creating new cards requires a connection. You can still edit existing cards.');
      return;
    }
    
    try {
      const res = await fetch(`${SERVER_URL}/boards/${currentBoardId}/cards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ listId, title: 'New Card' }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to create card');
      }
      
      const data = await res.json();
      
      // Add locally
      dispatch({ type: 'ADD_CARD', card: data.card });
      
      // Broadcast to other clients
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('card-created', { card: data.card, boardId: currentBoardId });
      }
    } catch (err) {
      console.error('Failed to create card', err);
      alert('Failed to create card. Please check your connection.');
    }
  };

  // Load board based on workspace selection
  useEffect(() => {
    if (!user || !token) return;
    
    async function loadBoard() {
      try {
        let url;
        if (currentTeam) {
          // Load team board
          url = `${SERVER_URL}/boards/team/${currentTeam.id}`;
        } else {
          // Load personal board
          url = `${SERVER_URL}/boards/user/${user.id}`;
        }
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
          throw new Error('Failed to load board');
        }
        
        const data = await res.json();
        
        // Set new board ID - this will trigger the socket effect to reconnect
        setCurrentBoardId(data.board.id);
        dispatch({ type: 'LOAD_SNAPSHOT', board: data.board, lists: data.lists, cards: data.cards });
      } catch (err) {
        console.error('⚠️ Failed to load board (this is normal if offline):', err.message);
        // If offline, we'll keep the current board state and just show offline indicator
      }
    }
    
    loadBoard();
  }, [currentTeam, user, token]);

  // Socket connection - reconnects whenever board ID changes
  useEffect(() => {
    if (!currentBoardId || !token) return;
    
    // Initial load / resync snapshot.
    async function loadSnapshot() {
      try {
        const res = await fetch(`${SERVER_URL}/boards/${currentBoardId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
          console.log('⚠️ Could not fetch snapshot (offline?) - keeping current state');
          return;
        }
        
        const data = await res.json();
        dispatch({ type: 'LOAD_SNAPSHOT', board: data.board, lists: data.lists, cards: data.cards });
      } catch (err) {
        console.log('⚠️ Snapshot fetch failed (expected if offline):', err.message);
        // Keep current state, don't crash
      }
    }

    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🟢 Socket connected! Joining board:', currentBoardId);
      socket.emit('join-board', { boardId: currentBoardId });
      dispatch({ type: 'SET_CONNECTION', status: 'syncing' });

      // Flush anything queued while offline
      console.log('🔄 Flushing offline queue...');
      const queuedOps = flushQueue((ops) => {
        if (ops.length > 0) {
          console.log(`📤 Sending ${ops.length} queued operations`, ops);
          socket.emit('op-batch', { ops });
        }
      });

      if (queuedOps.length > 0) {
        console.log(`⏳ ${queuedOps.length} queued ops sent - waiting for server to process...`);
        // Wait for server to process all operations and broadcast op-resolved events
        // Then reload snapshot to get any changes from other clients
        setTimeout(() => {
          loadSnapshot().then(() => {
            console.log('✅ Snapshot reloaded after queue processed, status: online');
            dispatch({ type: 'SET_CONNECTION', status: 'online' });
          });
        }, 2000); // 2 second delay to ensure operations are processed
      } else {
        // No queued operations, safe to reload immediately
        loadSnapshot().then(() => {
          console.log('✅ Snapshot loaded, status: online');
          dispatch({ type: 'SET_CONNECTION', status: 'online' });
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
      dispatch({ type: 'SET_CONNECTION', status: 'offline' });
    });

    socket.on('op-resolved', ({ cardId, field, value, applied }) => {
      const current = state.cards.find((c) => c.id === cardId);
      if (current && current._pending && current[field] !== value) {
        setToast('Card updated by another user');
        setTimeout(() => setToast(null), 2000);
      }
      if (applied) dispatch({ type: 'APPLY_RESOLVED', cardId, field, value });
    });

    socket.on('card-created', ({ card }) => {
      dispatch({ type: 'ADD_CARD', card });
    });

    socket.on('card-deleted', ({ cardId }) => {
      dispatch({ type: 'DELETE_CARD', cardId });
    });

    function handleOffline() {
      console.log('🔴 Browser offline event detected');
      dispatch({ type: 'SET_CONNECTION', status: 'offline' });
    }
    
    function handleOnline() {
      console.log('🟢 Browser online event detected - socket will reconnect');
      // Socket.io will automatically attempt to reconnect
      // The 'connect' event handler will handle the rest
    }
    
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      socket.emit('leave-board', { boardId: currentBoardId });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoardId, token]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        padding: '12px 20px',
        minHeight: 64,
        alignItems: 'center',
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#2196F3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              flexShrink: 0
            }}>
              S
            </div>
            <h1 style={{ 
              margin: 0, 
              fontSize: 18,
              fontWeight: 600,
              color: '#212121',
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap'
            }}>
              SyncBoard
            </h1>
          </div>
          
          <div style={{ borderLeft: '1px solid #e0e0e0', height: 28, display: window.innerWidth > 768 ? 'block' : 'none' }} />
          
          <TeamSelector />
          
          <button
            onClick={() => navigate('/teams')}
            style={{
              padding: '6px 12px',
              background: '#f5f5f9',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: '#424242',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            👥 Manage Teams
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ConnectionStatus status={state.connection} />
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10
          }}>
            <span style={{ fontSize: 13, color: '#424242', fontWeight: 500, display: window.innerWidth > 640 ? 'inline' : 'none' }}>{user?.name}</span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#2196F3',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px',
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: '#424242',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#f5f5f5';
                e.target.style.borderColor = '#bdbdbd';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#fff';
                e.target.style.borderColor = '#e0e0e0';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <div style={{ 
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '20px 24px'
      }}>
        <Board
          lists={state.lists}
          cards={state.cards}
          onTitleChange={onTitleChange}
          onCardMove={onCardMove}
          onAddCard={onAddCard}
          onCardClick={setSelectedCard}
        />
      </div>
      <ConflictToast message={toast} onDismiss={() => setToast(null)} />
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onTitleChange={onTitleChange}
          onDescriptionChange={onDescriptionChange}
          onDeleteCard={onDeleteCard}
        />
      )}
    </div>
  );
}
