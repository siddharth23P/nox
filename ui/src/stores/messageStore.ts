import { create } from 'zustand';

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  username?: string;
  parent_id?: string;
  content_md: string;
  content_html: string;
  reply_count?: number;
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
  activeThreadId: string | null;
  threadMessages: Message[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  
  setActiveChannel: (channel: Channel) => void;
  setChannels: (channels: Channel[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: (channelId: string, before: string) => Promise<void>;
  sendMessage: (channelId: string, contentMd: string) => Promise<void>;
  
  setActiveThread: (messageId: string | null) => void;
  fetchThread: (channelId: string, messageId: string) => Promise<void>;
  sendThreadReply: (channelId: string, messageId: string, contentMd: string) => Promise<void>;
}

const API_BASE_URL = 'http://localhost:8080/v1';

export const useMessageStore = create<MessageState>((set, get) => ({
  activeChannel: null,
  channels: [],
  messages: [],
  activeThreadId: null,
  threadMessages: [],
  isLoading: false,
  error: null,
  hasMore: true,

  setActiveChannel: (channel) => set({ activeChannel: channel }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  fetchMessages: async (channelId) => {
    set({ isLoading: true, error: null, hasMore: true });
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '22222222-2222-2222-2222-222222222222';
      
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      set({ messages: data, isLoading: false, hasMore: data.length === 50 });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadMoreMessages: async (channelId, before) => {
    const state = get();
    if (state.isLoading || !state.hasMore) return;
    
    set({ isLoading: true, error: null });
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '22222222-2222-2222-2222-222222222222';
      
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages?before=${encodeURIComponent(before)}`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      if (!response.ok) throw new Error('Failed to load more messages');
      
      const data = await response.json();
      set((prev) => ({ 
        messages: [...data, ...prev.messages], 
        isLoading: false,
        hasMore: data.length === 50 
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (channelId, contentMd) => {
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '22222222-2222-2222-2222-222222222222';

      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
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
  },

  setActiveThread: (messageId) => set({ activeThreadId: messageId }),
  
  fetchThread: async (channelId, messageId) => {
    set({ isLoading: true, error: null });
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '22222222-2222-2222-2222-222222222222';

      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/replies`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch thread replies');
      
      const data = await response.json();
      set({ threadMessages: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendThreadReply: async (channelId, messageId, contentMd) => {
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '22222222-2222-2222-2222-222222222222';

      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        },
        body: JSON.stringify({ content_md: contentMd, parent_id: messageId }),
      });
      
      if (!response.ok) throw new Error('Failed to send reply');
      
      const newReply = await response.json();
      // Optimistically update threadMessages
      set((state) => ({ 
        threadMessages: [...state.threadMessages, newReply],
        // Optimistically update reply_count of the parent message in the main view
        messages: state.messages.map(m => 
          m.id === messageId 
            ? { ...m, reply_count: (m.reply_count || 0) + 1 } 
            : m
        )
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  }
}));
