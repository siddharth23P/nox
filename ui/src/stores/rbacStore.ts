import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

export interface Permission {
  [key: string]: boolean;
}

export interface Role {
  id: string;
  org_id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  permissions: Permission;
  created_at: string;
  updated_at: string;
}

export interface PermissionCategory {
  name: string;
  permissions: string[];
}

export interface EffectivePermissions {
  permissions: Permission;
  highest_role: string;
}

interface RBACState {
  roles: Role[];
  permissionSchema: PermissionCategory[];
  selectedRole: Role | null;
  userPermissions: EffectivePermissions | null;
  isLoading: boolean;
  error: string | null;

  fetchRoles: (orgId: string) => Promise<void>;
  fetchPermissionSchema: () => Promise<void>;
  createRole: (orgId: string, data: Partial<Role>) => Promise<Role | null>;
  updateRole: (orgId: string, roleId: string, data: Partial<Role>) => Promise<Role | null>;
  deleteRole: (orgId: string, roleId: string) => Promise<boolean>;
  assignRole: (orgId: string, userId: string, roleId: string) => Promise<boolean>;
  removeRole: (orgId: string, userId: string, roleId: string) => Promise<boolean>;
  fetchUserPermissions: (orgId: string, userId: string) => Promise<void>;
  setSelectedRole: (role: Role | null) => void;
  clearError: () => void;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('nox_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

export const useRBACStore = create<RBACState>((set) => ({
  roles: [],
  permissionSchema: [],
  selectedRole: null,
  userPermissions: null,
  isLoading: false,
  error: null,

  fetchRoles: async (orgId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/roles`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      set({ roles: data.roles || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchPermissionSchema: async () => {
    try {
      const res = await fetch(`${API_BASE}/permissions/schema`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch permission schema');
      const data = await res.json();
      set({ permissionSchema: data.categories || [] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createRole: async (orgId: string, data: Partial<Role>) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/roles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create role');
      }
      const role = await res.json();
      set((state) => ({ roles: [role, ...state.roles], isLoading: false }));
      return role;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  updateRole: async (orgId: string, roleId: string, data: Partial<Role>) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update role');
      }
      const role = await res.json();
      set((state) => ({
        roles: state.roles.map((r) => (r.id === roleId ? role : r)),
        selectedRole: state.selectedRole?.id === roleId ? role : state.selectedRole,
        isLoading: false,
      }));
      return role;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  deleteRole: async (orgId: string, roleId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete role');
      }
      set((state) => ({
        roles: state.roles.filter((r) => r.id !== roleId),
        selectedRole: state.selectedRole?.id === roleId ? null : state.selectedRole,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  assignRole: async (orgId: string, userId: string, roleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${userId}/roles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role_id: roleId }),
      });
      if (!res.ok) throw new Error('Failed to assign role');
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  removeRole: async (orgId: string, userId: string, roleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to remove role');
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  fetchUserPermissions: async (orgId: string, userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${userId}/permissions`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      const data = await res.json();
      set({ userPermissions: { permissions: data.permissions || {}, highest_role: data.highest_role || '' } });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setSelectedRole: (role: Role | null) => set({ selectedRole: role }),
  clearError: () => set({ error: null }),
}));
