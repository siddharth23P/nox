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
  is_edited?: boolean;
  status?: 'sending' | 'sent' | 'error';
  reactions?: Record<string, number>;
  user_reactions?: string[];
  is_pinned?: boolean;
  is_bookmarked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageEdit {
  id: string;
  message_id: string;
  old_content_md: string;
  old_content_html: string;
  new_content_md: string;
  new_content_html: string;
  created_at: string;
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
  typingUsers: Record<string, string[]>; // channelId -> usernames
  
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
  
  editMessage: (channelId: string, messageId: string, contentMd: string) => Promise<void>;
  getMessageHistory: (channelId: string, messageId: string) => Promise<MessageEdit[]>;
  toggleReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  togglePin: (channelId: string, messageId: string) => Promise<void>;
  toggleBookmark: (channelId: string, messageId: string) => Promise<void>;
  
  // Real-time Event Handlers
  onMessageReceived: (message: Message) => void;
  onMessageEdited: (message: Message) => void;
  onReactionUpdated: (messageId: string, reactions: Record<string, number>) => void;
  onPinUpdated: (messageId: string, isPinned: boolean) => void;
  onTypingIndicator: (channelId: string, username: string, isTyping: boolean) => void;
}

const API_BASE_URL = 'http://localhost:8080/v1';

const getInitialChannel = (): Channel | null => {
  const saved = localStorage.getItem('nox_active_channel');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
};

export const useMessageStore = create<MessageState>((set, get) => ({
  activeChannel: getInitialChannel(),
  channels: [],
  messages: [],
  activeThreadId: null,
  threadMessages: [],
  isLoading: false,
  error: null,
  hasMore: true,
  typingUsers: {},

  setActiveChannel: (channel) => set((state) => {
    if (state.activeChannel?.id === channel.id) return state;
    
    // Persist to localStorage for initial load hydration
    localStorage.setItem('nox_active_channel', JSON.stringify(channel));
    
    return { 
      activeChannel: channel, 
      messages: [], 
      isLoading: true,
      activeThreadId: null,
      threadMessages: []
    };
  }),
  setChannels: (channels) => set({ channels }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    // 1. Prevent exact ID duplicates
    if (state.messages.some(m => m.id === message.id)) return state;
    // 2. Only add if it belongs to the current active channel
    if (state.activeChannel && message.channel_id !== state.activeChannel.id) return state;
    
    return { messages: [...state.messages, message] };
  }),
  
  // Handlers
  onMessageReceived: (message) => set((state) => {
    // 1. Prevent exact ID duplicates
    if (state.messages.some(m => m.id === message.id)) return state;
    
    // 2. Prevent content duplicates for own messages that are still 'sending'
    // This handles the race condition where WS arrives before POST response
    const isDuplicate = state.messages.some(m => 
      m.status === 'sending' && 
      m.user_id === message.user_id && 
      m.content_md === message.content_md
    );
    if (isDuplicate) return state;

    // If it's a thread reply, update threadMessages, else update main messages
    if (message.parent_id && state.activeThreadId === message.parent_id) {
      if (state.threadMessages.some(m => m.id === message.id)) return state;
      return { threadMessages: [...state.threadMessages, message] };
    }
    
    if (state.activeChannel && message.channel_id === state.activeChannel.id && !message.parent_id) {
      return { messages: [...state.messages, message] };
    }
    
    return state;
  }),
  
  onMessageEdited: (message) => set((state) => ({
    messages: state.messages.map(m => m.id === message.id ? message : m),
    threadMessages: state.threadMessages.map(m => m.id === message.id ? message : m)
  })),
  
  onReactionUpdated: (messageId, reactions) => set((state) => ({
    messages: state.messages.map(m => m.id === messageId ? { ...m, reactions } : m),
    threadMessages: state.threadMessages.map(m => m.id === messageId ? { ...m, reactions } : m)
  })),

  onPinUpdated: (messageId, isPinned) => set((state) => ({
    messages: state.messages.map(m => m.id === messageId ? { ...m, is_pinned: isPinned } : m),
    threadMessages: state.threadMessages.map(m => m.id === messageId ? { ...m, is_pinned: isPinned } : m)
  })),

  onTypingIndicator: (channelId, username, isTyping) => {
    const currentTyping = get().typingUsers[channelId] || [];
    
    if (isTyping) {
      if (currentTyping.includes(username)) return;
      
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [channelId]: [...currentTyping, username]
        }
      }));

      // Auto-clear after 5s
      setTimeout(() => {
        // Double check if they are still there before removing
        const latest = get().typingUsers[channelId] || [];
        if (latest.includes(username)) {
          get().onTypingIndicator(channelId, username, false);
        }
      }, 5000);
    } else {
      if (!currentTyping.includes(username)) return;
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [channelId]: currentTyping.filter(u => u !== username)
        }
      }));
    }
  },

  fetchMessages: async (channelId) => {
    const userStr = localStorage.getItem('nox_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || '';
    
    set({ isLoading: true, error: null, hasMore: true });
    
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      
      const data = await response.json();
      const reversedData = [...data].reverse();

      set((state) => {
        const currentChannelId = state.activeChannel?.id;
        
        if (currentChannelId === channelId) {
          const fetchedIds = new Set(reversedData.map((m: Message) => m.id));
          const localMessages = state.messages.filter(m => !fetchedIds.has(m.id));
          
          return { 
            messages: [...reversedData, ...localMessages], 
            isLoading: false, 
            hasMore: data.length === 50 
          };
        }
        
        return state;
      });
    } catch (err) {
      if (get().activeChannel?.id === channelId) {
        set({ error: (err as Error).message, isLoading: false });
      }
    }
  },

  loadMoreMessages: async (channelId, before) => {
    const state = get();
    if (state.isLoading || !state.hasMore) return;
    
    set({ isLoading: true, error: null });
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;
      
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages?before=${encodeURIComponent(before)}`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      if (!response.ok) throw new Error('Failed to load more messages');
      
      const data = await response.json();
      // data is DESC (older messages relative to the 'before' timestamp).
      // We reverse it to prepend in ASC order.
      const reversedData = [...data].reverse();
      set((prev) => ({ 
        messages: [...reversedData, ...prev.messages], 
        isLoading: false,
        hasMore: data.length === 50 
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (channelId, contentMd) => {
    const userStr = localStorage.getItem('nox_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || '';
    
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      username: user?.username || 'You',
      content_md: contentMd,
      content_html: contentMd,
      status: 'sending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({ messages: [...state.messages, tempMessage] }));

    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        },
        body: JSON.stringify({ content_md: contentMd }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`sendMessage failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to send message: ${response.status}`);
      }
      
      const newMessage = await response.json();
      
      // Replace temp message with real one
      set((state) => ({
        messages: state.messages.map(m => m.id === tempId ? { ...newMessage, status: 'sent' } : m)
      }));
    } catch (err) {
      console.error('sendMessage fetch exception:', err);
      set((state) => ({
        messages: state.messages.map(m => m.id === tempId ? { ...m, status: 'error' } : m),
        error: (err as Error).message 
      }));
      throw err;
    }
  },

  setActiveThread: (messageId) => set({ activeThreadId: messageId }),
  
  fetchThread: async (channelId, messageId) => {
    set({ isLoading: true, error: null });
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;

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
    const userStr = localStorage.getItem('nox_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || '';
    
    const tempId = `temp-thread-${Date.now()}`;
    const tempReply: Message = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      username: user?.username || 'You',
      parent_id: messageId,
      content_md: contentMd,
      content_html: contentMd,
      status: 'sending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({ threadMessages: [...state.threadMessages, tempReply] }));

    try {
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
      set((state) => ({ 
        threadMessages: state.threadMessages.map(m => m.id === tempId ? { ...newReply, status: 'sent' } : m),
        messages: state.messages.map(m => 
          m.id === messageId 
            ? { ...m, reply_count: (m.reply_count || 0) + 1 } 
            : m
        )
      }));
    } catch (err) {
      set((state) => ({
        threadMessages: state.threadMessages.map(m => m.id === tempId ? { ...m, status: 'error' } : m),
        error: (err as Error).message
      }));
      throw err;
    }
  },

  editMessage: async (channelId, messageId, contentMd) => {
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;

      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        },
        body: JSON.stringify({ content_md: contentMd }),
      });
      
      if (!response.ok) throw new Error('Failed to edit message');
      
      const updatedMessage = await response.json();
      set((state) => ({
        messages: state.messages.map(m => m.id === messageId ? updatedMessage : m),
        threadMessages: state.threadMessages.map(m => m.id === messageId ? updatedMessage : m)
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  getMessageHistory: async (channelId, messageId) => {
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;

      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/history`, {
        headers: {
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch message history');
      return await response.json();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  toggleReaction: async (channelId, messageId, emoji) => {
    const state = get();
    const userStr = localStorage.getItem('nox_user');
    const userId = userStr ? JSON.parse(userStr).id : '' ;
    
    const msg = state.messages.find(m => m.id === messageId) || state.threadMessages.find(m => m.id === messageId);
    if (!msg) return;

    const isReacted = msg.user_reactions?.includes(emoji);
    const action = isReacted ? 'remove' : 'add';

    const updateFn = (m: Message): Message => {
      if (m.id !== messageId) return m;

      const currentCount = m.reactions?.[emoji] || 0;
      const newCount = isReacted ? currentCount - 1 : currentCount + 1;
      
      const newReactions = { ...m.reactions };
      if (newCount <= 0) delete newReactions[emoji];
      else newReactions[emoji] = newCount;

      const newUserReactions = isReacted 
        ? (m.user_reactions || []).filter(e => e !== emoji)
        : [...(m.user_reactions || []), emoji];

      return { ...m, reactions: newReactions, user_reactions: newUserReactions };
    };

    set(state => ({
      messages: state.messages.map(updateFn),
      threadMessages: state.threadMessages.map(updateFn)
    }));

    try {
      await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        },
        body: JSON.stringify({ emoji, action }),
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  },

  togglePin: async (channelId, messageId) => {
    const updateFn = (m: Message): Message => m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m;
    set(state => ({
      messages: state.messages.map(updateFn),
      threadMessages: state.threadMessages.map(updateFn)
    }));

    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;
      await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  },

  toggleBookmark: async (channelId, messageId) => {
    const updateFn = (m: Message): Message => m.id === messageId ? { ...m, is_bookmarked: !m.is_bookmarked } : m;
    set(state => ({
      messages: state.messages.map(updateFn),
      threadMessages: state.threadMessages.map(updateFn)
    }));

    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '' ;
      await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-ID': localStorage.getItem('nox_org_id') || '00000000-0000-0000-0000-000000000001',
          'X-User-ID': localStorage.getItem('nox_token') ? userId : '',
        }
      });
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  }
}));
