import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nox_token') || '';
  return { Authorization: `Bearer ${token}` };
}

export interface Category {
  id: string;
  org_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface CategoryWithChannels extends Category {
  channels: {
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
  }[];
}

interface CategoryState {
  categories: CategoryWithChannels[];
  collapsedCategories: Set<string>;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (order: { id: string; position: number }[]) => Promise<void>;
  setChannelCategory: (channelId: string, categoryId: string | null) => Promise<void>;
  toggleCollapse: (categoryId: string) => void;
}

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem('nox_collapsed_categories');
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveCollapsed(collapsed: Set<string>) {
  localStorage.setItem('nox_collapsed_categories', JSON.stringify([...collapsed]));
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  collapsedCategories: loadCollapsed(),

  fetchCategories: async () => {
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      set({ categories: data });
    } catch (err) {
      console.error('fetchCategories error:', err);
    }
  },

  createCategory: async (name: string) => {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create category');
    }
    // Refresh list
    await get().fetchCategories();
  },

  updateCategory: async (id: string, name: string) => {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update category');
    }
    await get().fetchCategories();
  },

  deleteCategory: async (id: string) => {
    const response = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete category');
    }
    // Remove from collapsed set
    const collapsed = new Set(get().collapsedCategories);
    collapsed.delete(id);
    saveCollapsed(collapsed);
    set({ collapsedCategories: collapsed });

    await get().fetchCategories();
  },

  reorderCategories: async (order: { id: string; position: number }[]) => {
    const response = await fetch(`${API_BASE}/categories/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ categories: order }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reorder categories');
    }
    await get().fetchCategories();
  },

  setChannelCategory: async (channelId: string, categoryId: string | null) => {
    const response = await fetch(`${API_BASE}/channels/${channelId}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ category_id: categoryId }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to set channel category');
    }
    await get().fetchCategories();
  },

  toggleCollapse: (categoryId: string) => {
    const collapsed = new Set(get().collapsedCategories);
    if (collapsed.has(categoryId)) {
      collapsed.delete(categoryId);
    } else {
      collapsed.add(categoryId);
    }
    saveCollapsed(collapsed);
    set({ collapsedCategories: collapsed });
  },
}));
