import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Trash2, Edit3, ChevronRight } from 'lucide-react';
import { useRBACStore, Role } from '../../stores/rbacStore';
import { useAuthStore } from '../../stores/authStore';
import { RoleEditor } from './RoleEditor';

export const RolesManager: React.FC = () => {
  const { roles, fetchRoles, deleteRole, isLoading, error, clearError } = useRBACStore();
  const { orgId } = useAuthStore();

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchRoles(orgId);
    }
  }, [orgId, fetchRoles]);

  const handleDelete = async (roleId: string) => {
    if (!orgId) return;
    await deleteRole(orgId, roleId);
    setConfirmDelete(null);
  };

  const showEditor = editingRole !== null || isCreating;

  return (
    <div className="flex h-full" data-testid="roles-manager">
      {/* Role List */}
      <div className={`${showEditor ? 'w-1/2' : 'w-full'} flex flex-col border-r border-white/5 transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Shield size={22} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Roles & Permissions</h2>
              <p className="text-gray-500 text-sm">Manage who can do what in your organization</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingRole(null);
              setIsCreating(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            data-testid="create-role-btn"
          >
            <Plus size={16} />
            New Role
          </motion.button>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={clearError} className="text-red-300 hover:text-white ml-2">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {isLoading && roles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No roles found. Create one to get started.</div>
          ) : (
            roles.map((role, index) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                  editingRole?.id === role.id
                    ? 'bg-white/[0.08] border-blue-500/30'
                    : 'bg-black/40 border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                }`}
                onClick={() => {
                  setIsCreating(false);
                  setEditingRole(role);
                }}
                data-testid={`role-item-${role.name.toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: role.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{role.name}</span>
                      {role.is_default && (
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs">
                      Position: {role.position} &middot;{' '}
                      {Object.values(role.permissions).filter(Boolean).length} permissions
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!role.is_default && (
                    <>
                      {confirmDelete === role.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30 transition-colors"
                            data-testid={`confirm-delete-${role.name.toLowerCase()}`}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(role.id);
                          }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
                          data-testid={`delete-role-${role.name.toLowerCase()}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                  <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-500 hover:text-white transition-all">
                    <Edit3 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-gray-600" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="overflow-hidden bg-[#030712]/80 backdrop-blur-xl"
          >
            <RoleEditor
              role={isCreating ? null : editingRole}
              isCreating={isCreating}
              onClose={() => {
                setEditingRole(null);
                setIsCreating(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// This is used in the error banner but imported from lucide above via the parent;
// we define a simple fallback X here to avoid a second import conflict.
const X: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
