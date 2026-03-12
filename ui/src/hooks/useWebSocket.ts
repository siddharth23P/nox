import { useEffect, useRef } from 'react';
import { useMessageStore } from '../stores/messageStore';
import { useAuthStore } from '../stores/authStore';

const WS_URL = 'ws://localhost:8080/ws';

export function useWebSocket() {
  const { 
    onMessageReceived, 
    onMessageEdited, 
    onReactionUpdated, 
    onReadReceiptUpdated,
    onPinUpdated 
  } = useMessageStore();
  const { user } = useAuthStore();
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
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;
        console.log('WS RECEIVED:', type, payload);

        switch (type) {
          case 'MESSAGE_CREATED':
            onMessageReceived(payload);
            break;
          case 'MESSAGE_EDITED':
            onMessageEdited(payload);
            break;
          case 'REACTION_UPDATED':
            onReactionUpdated(payload.message_id, payload.reactions);
            break;
          case 'READ_RECEIPT_UPDATED':
            onReadReceiptUpdated(payload);
            break;
          case 'PIN_UPDATED':
            onPinUpdated(payload.message_id, payload.is_pinned);
            break;
          default:
            console.log('Unhandled WS Event:', type, payload);
        }
      } catch (err) {
        console.error('WebSocket parsing error:', err);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      ws.current = null;
      // In production, you would add reconnection logic here
    };

    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [user, onMessageReceived, onMessageEdited, onReactionUpdated, onReadReceiptUpdated, onPinUpdated]);
}
