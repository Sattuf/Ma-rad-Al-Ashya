import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3004', {
      autoConnect: true,
      reconnection: true,
      transports: ['websocket'],
      // Read the token on every (re)connect: access tokens expire after 15 minutes and
      // the auth interceptor refreshes the stored one.
      auth: (cb) => cb({ token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null }),
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
