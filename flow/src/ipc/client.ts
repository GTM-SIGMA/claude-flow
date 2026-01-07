import type { CanvasMessage, ControllerMessage } from './types';

export interface IPCClient {
  send: (message: CanvasMessage) => void;
  onMessage: (handler: (message: ControllerMessage) => void) => void;
  close: () => void;
}

export async function connectToIPC(socketPath: string): Promise<IPCClient> {
  let messageHandler: ((message: ControllerMessage) => void) | null = null;

  const socket = await Bun.connect({
    unix: socketPath,
    socket: {
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
      error(socket, error) {
        console.error('IPC client error:', error);
      },
      close() {
        // Connection closed
      },
    },
  });

  return {
    send(message: CanvasMessage) {
      socket.write(JSON.stringify(message) + '\n');
    },
    onMessage(handler) {
      messageHandler = handler;
    },
    close() {
      socket.end();
    },
  };
}
