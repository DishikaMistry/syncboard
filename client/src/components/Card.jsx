import { useDraggable } from '@dnd-kit/core';
import { useState } from 'react';

export default function Card({ card, onTitleChange, onCardClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const [isHovered, setIsHovered] = useState(false);
  
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: '#fff',
        borderRadius: 6,
        padding: '10px',
        marginBottom: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        border: '1px solid #e0e0e0',
        cursor: 'pointer',
        transition: isDragging ? 'none' : 'all 0.2s',
        opacity: isDragging ? 0.6 : 1,
        userSelect: 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseOver={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
          e.currentTarget.style.borderColor = '#bdbdbd';
        }
      }}
      onMouseOut={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
          e.currentTarget.style.borderColor = '#e0e0e0';
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onCardClick && onCardClick(card);
      }}
      {...attributes}
    >
      {/* Drag handle - always visible on left */}
      <div
        style={{
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          color: '#999',
          fontSize: 16,
          flexShrink: 0,
          userSelect: 'none',
          transition: 'color 0.2s'
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
          e.currentTarget.style.color = '#667eea';
        }}
        onMouseOut={(e) => {
          e.stopPropagation();
          e.currentTarget.style.color = '#999';
        }}
        {...listeners}
        title="Drag to move"
      >
        ⋮⋮
      </div>
      
      {/* Card content - clicking opens modal */}
      <div style={{ 
        flex: 1,
        fontSize: 14,
        color: '#212121',
        lineHeight: 1.4,
        wordBreak: 'break-word'
      }}>
        {card.title || 'Untitled'}
      </div>
    </div>
  );
}
