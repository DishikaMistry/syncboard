import { DndContext } from '@dnd-kit/core';
import { useState } from 'react';
import List from './List';

export default function Board({ lists, cards, onTitleChange, onCardMove, onAddCard, onCardClick }) {
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id;
    const targetListId = over.id;
    const card = cards.find((c) => c.id === cardId);
    if (card && card.list_id !== targetListId) {
      onCardMove(cardId, targetListId);
    }
  }

  const handleAddList = () => {
    if (newListName.trim()) {
      // TODO: Add API call to create new list
      console.log('Create list:', newListName);
      setNewListName('');
      setIsAddingList(false);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ 
        display: 'flex',
        alignItems: 'flex-start',
        height: '100%'
      }}>
        {lists
          .sort((a, b) => a.position - b.position)
          .map((list) => (
            <List key={list.id} list={list} cards={cards} onTitleChange={onTitleChange} onAddCard={onAddCard} onCardClick={onCardClick} />
          ))}
        
        {/* Add List Button */}
        <div style={{
          width: 280,
          minWidth: 280,
          marginRight: 16
        }}>
          {!isAddingList ? (
            <button
              onClick={() => setIsAddingList(true)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: 8,
                color: '#424242',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(0,0,0,0.08)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(0,0,0,0.05)'}
            >
              + Add another list
            </button>
          ) : (
            <div style={{
              background: '#fff',
              borderRadius: 8,
              padding: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              border: '1px solid #e0e0e0'
            }}>
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddList();
                  if (e.key === 'Escape') setIsAddingList(false);
                }}
                placeholder="Enter list title..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  fontSize: 14,
                  marginBottom: 8,
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAddList}
                  style={{
                    padding: '6px 12px',
                    background: '#2196F3',
                    border: 'none',
                    borderRadius: 4,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  Add list
                </button>
                <button
                  onClick={() => {
                    setIsAddingList(false);
                    setNewListName('');
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: '#757575',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}
