import { useEffect, useRef } from 'react';
import { useMessageStore } from '../stores/messageStore';
import { useAuthStore } from '../stores/authStore';

const WS_URL = 'ws://localhost:8080/ws';

export function useWebSocket() {
  const user = useAuthStore(state => state.user);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    if (ws.current) return; // Already connected

    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      const win = window as unknown as { IS_PLAYWRIGHT?: boolean; WS_CONNECTED?: boolean };
      if (win.IS_PLAYWRIGHT) {
        win.WS_CONNECTED = true;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        // Get fresh handlers from store to avoid dependency on store state in this effect
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
        }
      } catch {
        // Silently handle parsing errors in production
      }
    };

    ws.current.onclose = () => {
      ws.current = null;
    };

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [user, user?.id]); // Reconnect only if user object or ID changes
}
