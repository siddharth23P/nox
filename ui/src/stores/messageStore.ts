import { create } from 'zustand';

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content_md: string;
  content_html: string;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  org_id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageState {
  activeChannel: Channel | null;
  channels: Channel[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  setActiveChannel: (channel: Channel) => void;
  setChannels: (channels: Channel[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, contentMd: string) => Promise<void>;
}

const API_BASE_URL = 'http://localhost:8080/v1';

export const useMessageStore = create<MessageState>((set, get) => ({
  activeChannel: null,
  channels: [],
  messages: [],
  isLoading: false,
  error: null,

  setActiveChannel: (channel) => set({ activeChannel: channel }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  fetchMessages: async (channelId) => {
    set({ isLoading: true, error: null });
    try {
      // Setup minimal mock headers to pass through Bifrost authentication temporarily
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || 'test-org',
          'X-User-ID': localStorage.getItem('nox_token') ? 'test-user-uuid' : '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      set({ messages: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (channelId, contentMd) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || 'test-org',
          'X-User-ID': localStorage.getItem('nox_token') ? 'test-user-uuid' : '',
        },
        body: JSON.stringify({ content_md: contentMd }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      const newMessage = await response.json();
      // Assume WebSocket will eventually broadcast this, but for now we optimistically UI update.
      get().addMessage(newMessage);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  }
}));
