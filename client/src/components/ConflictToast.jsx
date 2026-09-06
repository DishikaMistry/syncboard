export default function ConflictToast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#333',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 14,
      }}
      onAnimationEnd={onDismiss}
    >
      {message}
    </div>
  );
}
