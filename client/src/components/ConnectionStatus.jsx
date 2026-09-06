export default function ConnectionStatus({ status }) {
  const labels = { online: 'Connected', offline: 'Offline', syncing: 'Syncing' };
  const colors = { online: '#4CAF50', offline: '#F44336', syncing: '#FF9800' };
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8, 
      fontSize: 13,
      fontWeight: 500,
      padding: '6px 12px',
      background: '#f5f5f5',
      borderRadius: 4,
      border: '1px solid #e0e0e0',
      color: '#424242'
    }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colors[status] || '#999',
          display: 'inline-block'
        }}
      />
      {labels[status] || status}
    </div>
  );
}
