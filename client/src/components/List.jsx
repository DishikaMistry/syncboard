import { useDroppable } from '@dnd-kit/core';
import Card from './Card';

export default function List({ list, cards, onTitleChange, onAddCard, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        width: 300,
        background: '#fff',
        borderRadius: 8,
        padding: '12px',
        marginRight: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        border: '1px solid #e0e0e0',
        maxHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s',
        ...(isOver && {
          boxShadow: '0 4px 12px rgba(33,150,243,0.3)',
          borderColor: '#2196F3'
        })
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: 15,
          fontWeight: 600,
          color: '#212121',
          letterSpacing: '-0.2px'
        }}>
          {list.name}
        </h3>
        <span style={{
          fontSize: 12,
          color: '#757575',
          background: '#f5f5f5',
          padding: '2px 6px',
          borderRadius: 10,
          fontWeight: 500
        }}>
          {cards.filter((c) => c.list_id === list.id).length}
        </span>
      </div>
      <div style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
        marginBottom: 8
      }}>
        {cards
          .filter((c) => c.list_id === list.id)
          .sort((a, b) => a.position - b.position)
          .map((card) => (
            <Card key={card.id} card={card} onTitleChange={onTitleChange} onCardClick={onCardClick} />
          ))}
      </div>
      <button
        onClick={() => onAddCard(list.id)}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px dashed #bdbdbd',
          borderRadius: 6,
          background: 'transparent',
          color: '#757575',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.target.style.background = '#f5f5f5';
          e.target.style.borderColor = '#2196F3';
          e.target.style.color = '#2196F3';
        }}
        onMouseOut={(e) => {
          e.target.style.background = 'transparent';
          e.target.style.borderColor = '#bdbdbd';
          e.target.style.color = '#757575';
        }}
      >
        + Add card
      </button>
    </div>
  );
}
