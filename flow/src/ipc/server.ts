import { unlinkSync, existsSync } from 'fs';
import type { Socket } from 'bun';
import type { CanvasMessage, ControllerMessage } from './types';

export interface IPCServer {
  socketPath: string;
  send: (message: CanvasMessage) => void;
  onMessage: (handler: (message: ControllerMessage) => void) => void;
  close: () => void;
}

export function createIPCServer(socketPath: string): IPCServer {
  // Clean up existing socket
  if (existsSync(socketPath)) {
    unlinkSync(socketPath);
  }

  let messageHandler: ((message: ControllerMessage) => void) | null = null;
  let clientSocket: Socket<unknown> | null = null;

  const server = Bun.listen({
    unix: socketPath,
    socket: {
      open(socket) {
        clientSocket = socket;
      },
      data(socket, data) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const message = JSON.parse(line) as ControllerMessage;
            messageHandler?.(message);
          } catch (e) {
            console.error('Failed to parse IPC message:', e);
          }
        }
      },
      close() {
        clientSocket = null;
      },
      error(socket, error) {
        console.error('IPC socket error:', error);
      },
    },
  });

  return {
    socketPath,
    send(message: CanvasMessage) {
      if (clientSocket) {
        clientSocket.write(JSON.stringify(message) + '\n');
      }
    },
    onMessage(handler) {
      messageHandler = handler;
    },
    close() {
      server.stop();
      if (existsSync(socketPath)) {
        unlinkSync(socketPath);
      }
    },
  };
}
