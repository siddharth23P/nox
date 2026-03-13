import { useEffect } from 'react';
import { useMessageStore } from '../stores/messageStore';
import { useAuthStore } from '../stores/authStore';

const WS_URL = 'ws://localhost:8080/ws';
let globalWs: WebSocket | null = null;
let connectionPromise: Promise<WebSocket> | null = null;

export function useWebSocket() {
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (!user) {
      if (globalWs) {
        globalWs.close();
        globalWs = null;
        connectionPromise = null;
      }
      return;
    }

    if (globalWs) return;
    if (connectionPromise) return;

    connectionPromise = new Promise((resolve) => {
      const socket = new WebSocket(WS_URL);
      
      socket.onopen = () => {
        globalWs = socket;
        const win = window as unknown as { IS_PLAYWRIGHT?: boolean; WS_CONNECTED?: boolean };
        if (win.IS_PLAYWRIGHT) {
          win.WS_CONNECTED = true;
        }
        resolve(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { type, payload } = data;
          const store = useMessageStore.getState();

          switch (type) {
            case 'MESSAGE_CREATED':
              store.onMessageReceived(payload);
              break;
            case 'MESSAGE_EDITED':
              store.onMessageEdited(payload);
              break;
            case 'REACTION_UPDATED':
              store.onReactionUpdated(payload.message_id, payload.reactions);
              break;
            case 'PIN_UPDATED':
              store.onPinUpdated(payload.message_id, payload.is_pinned);
              break;
            case 'TYPING_INDICATOR':
              if (payload.user_id !== user?.id) {
                store.onTypingIndicator(payload.channel_id, payload.username, payload.is_typing);
              }
              break;
          }
        } catch (e) {
          console.error('WS Message error', e);
        }
      };

      socket.onclose = () => {
        globalWs = null;
        connectionPromise = null;
      };
    });
  }, [user]);

  const sendTyping = (channelId: string, isTyping: boolean) => {
    if (globalWs && globalWs.readyState === WebSocket.OPEN && user) {
      globalWs.send(JSON.stringify({
        type: 'TYPING',
        payload: {
          channel_id: channelId,
          user_id: user.id,
          username: user.username,
          is_typing: isTyping
        }
      }));
    }
  };

  return { sendTyping };
}
