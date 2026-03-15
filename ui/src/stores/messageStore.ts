import { create } from 'zustand';
import { marked } from 'marked';
import { renderMentionsInHTML } from '../utils/mentions';

/** Build auth headers from the JWT stored in localStorage. */
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nox_token') || '';
  return { Authorization: `Bearer ${token}` };
}

// Configure marked for GFM
marked.setOptions({ gfm: true, breaks: true });

/** Convert markdown to HTML, then render mention markup as styled spans. */
function mdToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return renderMentionsInHTML(html);
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  username?: string;
  parent_id?: string;
  reply_to?: string;
  content_md: string;
  content_html: string;
  reply_count?: number;
  is_edited?: boolean;
  status?: 'sending' | 'sent' | 'error';
  reactions?: Record<string, number>;
  user_reactions?: string[];
  is_pinned?: boolean;
  is_bookmarked?: boolean;
  is_deleted?: boolean;
  forward_source_id?: string;
  forward_source_username?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
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
  description?: string;
  topic?: string;
  is_private: boolean;
  created_by?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DMConversation {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  created_at: string;
}

export interface BrowsableChannel extends Channel {
  member_count: number;
  is_joined: boolean;
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
  replyTo: Message | null;
  highlightedMessageId: string | null;

  setActiveChannel: (channel: Channel) => void;
  setChannels: (channels: Channel[]) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  fetchChannels: () => Promise<void>;
  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: (channelId: string, before: string) => Promise<void>;
  loadMessagesAround: (channelId: string, messageId: string) => Promise<void>;
  sendMessage: (channelId: string, contentMd: string, parentId?: string, replyToId?: string) => Promise<void>;
  setReplyTo: (message: Message | null) => void;

  setActiveThread: (messageId: string | null) => void;
  fetchThread: (channelId: string, messageId: string) => Promise<void>;
  sendThreadReply: (channelId: string, messageId: string, contentMd: string) => Promise<void>;

  editMessage: (channelId: string, messageId: string, contentMd: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  hideMessage: (channelId: string, messageId: string) => Promise<void>;
  getMessageHistory: (channelId: string, messageId: string) => Promise<MessageEdit[]>;
  toggleReaction: (channelId: string, messageId: string, emoji: string) => Promise<void>;
  togglePin: (channelId: string, messageId: string) => Promise<void>;
  toggleBookmark: (channelId: string, messageId: string) => Promise<void>;
  forwardMessage: (messageId: string, targetChannelId: string) => Promise<void>;
  scrollToMessage: (messageId: string) => void;

  // Direct Messages (Issue #113)
  dmConversations: DMConversation[];
  fetchDMs: () => Promise<void>;
  createOrGetDM: (otherUserId: string) => Promise<DMConversation>;
  convertDMToChannel: (dmId: string, name: string, isPrivate?: boolean) => Promise<Channel>;

  resetForOrgSwitch: () => void;

  // Channel Discovery (Issue #121)
  browseChannels: () => Promise<BrowsableChannel[]>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
  fetchJoinedChannels: () => Promise<void>;

  // Real-time Event Handlers
  onMessageReceived: (message: Message) => void;
  onMessageEdited: (message: Message) => void;
  onMessageDeleted: (messageId: string) => void;
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
  replyTo: null,
  highlightedMessageId: null,
  dmConversations: [],

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
  
  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const orgId = localStorage.getItem('nox_org_id');
      if (!orgId) throw new Error('No organization selected');

      const response = await fetch(`${API_BASE_URL}/channels`, {
        headers: authHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch channels');
      const data = await response.json();
      set({ channels: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  // Direct Messages (Issue #113)
  fetchDMs: async () => {
    try {
      const userStr = localStorage.getItem('nox_user');
      const userId = userStr ? JSON.parse(userStr).id : '';
      if (!userId) return;

      const response = await fetch(`${API_BASE_URL}/dm`, {
        headers: authHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch DMs');
      const data = await response.json();
      set({ dmConversations: data });
    } catch (err) {
      console.error('fetchDMs error:', err);
    }
  },

  createOrGetDM: async (otherUserId: string) => {
    const response = await fetch(`${API_BASE_URL}/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ user_id: otherUserId }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create DM');
    }

    const dm = await response.json();

    // Add to local list if not already present
    set((state) => {
      if (state.dmConversations.some(d => d.id === dm.id)) return state;
      return { dmConversations: [dm, ...state.dmConversations] };
    });

    return dm;
  },

  convertDMToChannel: async (dmId: string, name: string, isPrivate = true) => {
    const response = await fetch(`${API_BASE_URL}/dm/${dmId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, is_private: isPrivate }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to convert DM to channel');
    }

    const channel: Channel = await response.json();

    // Remove from DM list and add to channels
    set((state) => ({
      dmConversations: state.dmConversations.filter(d => d.id !== dmId),
      channels: [...state.channels, channel],
      activeChannel: channel,
    }));

    return channel;
  },

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

  onMessageDeleted: (messageId) => set((state) => ({
    messages: state.messages.filter(m => m.id !== messageId),
    threadMessages: state.threadMessages.filter(m => m.id !== messageId)
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
      if (!currentTyping.includes(username)) {
        set((state) => ({
          typingUsers: {
            ...state.typingUsers,
            [channelId]: [...currentTyping, username]
          }
        }));
      }

      // Refresh auto-clear timeout on every typing event (even if already in list)
      const timeoutId = `typing-${channelId}-${username}`;
      const win = window as unknown as Record<string, ReturnType<typeof setTimeout> | undefined>;
      if (win[timeoutId]) clearTimeout(win[timeoutId]);

      win[timeoutId] = setTimeout(() => {
        const latest = get().typingUsers[channelId] || [];
        if (latest.includes(username)) {
          get().onTypingIndicator(channelId, username, false);
        }
        delete win[timeoutId];
      }, 10000);
    } else {
      if (!currentTyping.includes(username)) return;
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [channelId]: currentTyping.filter(u => u !== username)
        }
      }));
      const timeoutId = `typing-${channelId}-${username}`;
      const win = window as unknown as Record<string, ReturnType<typeof setTimeout> | undefined>;
      if (win[timeoutId]) {
        clearTimeout(win[timeoutId]);
        delete win[timeoutId];
      }
    }
  },

  fetchMessages: async (channelId) => {
    set({ isLoading: true, error: null, hasMore: true });

    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages`, {
        headers: authHeaders()
      });

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const body = await response.json();
      const data: Message[] = body.messages || body;
      const hasMore: boolean = body.has_more ?? data.length === 50;
      // Backend already returns messages in chronological order (oldest first)
      set((state) => {
        const currentChannelId = state.activeChannel?.id;

        if (currentChannelId === channelId) {
          const fetchedIds = new Set(data.map((m: Message) => m.id));
          const localMessages = state.messages.filter(m => !fetchedIds.has(m.id));

          return {
            messages: [...data, ...localMessages],
            isLoading: false,
            hasMore,
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
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages?before=${encodeURIComponent(before)}`, {
        headers: authHeaders()
      });
      if (!response.ok) throw new Error('Failed to load more messages');

      const body = await response.json();
      const data: Message[] = body.messages || body;
      const hasMore: boolean = body.has_more ?? data.length === 50;
      // Backend already returns in chronological order (oldest first)
      set((prev) => ({
        messages: [...data, ...prev.messages],
        isLoading: false,
        hasMore,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadMessagesAround: async (channelId, messageId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/channels/${channelId}/messages?around=${encodeURIComponent(messageId)}&limit=50`,
        { headers: authHeaders() }
      );
      if (!response.ok) throw new Error('Failed to load messages');
      const body = await response.json();
      const data: Message[] = body.messages || body;
      set({
        messages: data,
        isLoading: false,
        hasMore: true, // there may be older messages above
        highlightedMessageId: messageId,
      });
      // Clear highlight after 3 seconds
      setTimeout(() => {
        if (get().highlightedMessageId === messageId) {
          set({ highlightedMessageId: null });
        }
      }, 3000);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendMessage: async (channelId, contentMd, parentId, replyToId) => {
    const userStr = localStorage.getItem('nox_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || '';
    
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      username: user?.username || 'You',
      parent_id: parentId,
      reply_to: replyToId,
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          content_md: contentMd,
          content_html: mdToHtml(contentMd),
          parent_id: parentId,
          reply_to: replyToId
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`sendMessage failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to send message: ${response.status}`);
      }
      
      const newMessage = await response.json();
      
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
  
  setReplyTo: (message) => set({ replyTo: message }),
  
  fetchThread: async (channelId, messageId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/replies`, {
        headers: authHeaders()
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          content_md: contentMd,
          content_html: mdToHtml(contentMd),
          parent_id: messageId,
        }),
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
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          content_md: contentMd,
          content_html: mdToHtml(contentMd),
        }),
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

  deleteMessage: async (channelId, messageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error('Failed to delete message');

      // Show tombstone instead of removing
      set((state) => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, is_deleted: true, content_md: '', content_html: '' } : m
        ),
        threadMessages: state.threadMessages.map(m =>
          m.id === messageId ? { ...m, is_deleted: true, content_md: '', content_html: '' } : m
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  hideMessage: async (channelId, messageId) => {
    // Optimistic: remove from view immediately
    const prevMessages = get().messages;
    set((state) => ({
      messages: state.messages.filter(m => m.id !== messageId),
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/hide`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        // Revert on error
        set({ messages: prevMessages });
        throw new Error('Failed to hide message');
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  getMessageHistory: async (channelId, messageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/history`, {
        headers: authHeaders()
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
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
      await fetch(`${API_BASE_URL}/channels/${channelId}/messages/${messageId}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      });
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  },
  
  forwardMessage: async (messageId, targetChannelId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/any/messages/${messageId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target_channel_id: targetChannelId }),
      });

      if (!response.ok) throw new Error('Failed to forward message');
      
      const newMessage = await response.json();
      
      // If the target channel is the active one, add it to the list
      const state = get();
      if (state.activeChannel?.id === targetChannelId) {
        set((state) => ({ messages: [...state.messages, newMessage] }));
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  scrollToMessage: (messageId) => {
    set({ highlightedMessageId: messageId });

    // Allow a tick for React to apply the highlighted state, then scroll
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Clear highlight after 2 seconds
    setTimeout(() => {
      set((state) => state.highlightedMessageId === messageId ? { highlightedMessageId: null } : state);
    }, 2000);
  },

  resetForOrgSwitch: () => {
    localStorage.removeItem('nox_active_channel');
    set({
      activeChannel: null,
      channels: [],
      messages: [],
      activeThreadId: null,
      threadMessages: [],
      isLoading: false,
      error: null,
      hasMore: true,
      typingUsers: {},
      replyTo: null,
      highlightedMessageId: null,
      dmConversations: [],
    });
  },

  // ---------- Channel Discovery (Issue #121) ----------

  browseChannels: async () => {
    const orgId = localStorage.getItem('nox_org_id');
    if (!orgId) throw new Error('No organization selected');

    const response = await fetch(`${API_BASE_URL}/channels/browse`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Failed to browse channels');
    return response.json();
  },

  joinChannel: async (channelId: string) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!response.ok) throw new Error('Failed to join channel');

    // Refresh the sidebar channel list
    await get().fetchJoinedChannels();
  },

  leaveChannel: async (channelId: string) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!response.ok) throw new Error('Failed to leave channel');

    // Refresh the sidebar channel list
    await get().fetchJoinedChannels();
  },

  fetchJoinedChannels: async () => {
    try {
      const orgId = localStorage.getItem('nox_org_id');
      if (!orgId) return;

      const response = await fetch(`${API_BASE_URL}/channels/joined`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch joined channels');
      const data = await response.json();
      set({ channels: data });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
