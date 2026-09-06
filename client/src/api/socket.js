import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export function createSocket() {
  return io(SERVER_URL, { autoConnect: true, reconnection: true });
}
