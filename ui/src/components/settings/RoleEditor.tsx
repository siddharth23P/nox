import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Shield } from 'lucide-react';
import { useRBACStore } from '../../stores/rbacStore';
import type { Role, PermissionCategory } from '../../stores/rbacStore';
import { useAuthStore } from '../../stores/authStore';

interface RoleEditorProps {
  role: Role | null;
  isCreating?: boolean;
  onClose: () => void;
}

const ROLE_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E91E63', '#99AAB5'];

// Inner component that resets state when key changes (via role.id).
const RoleEditorInner: React.FC<RoleEditorProps> = ({ role, isCreating = false, onClose }) => {
  const { updateRole, createRole, fetchPermissionSchema, permissionSchema } = useRBACStore();
  const { orgId } = useAuthStore();

  const [name, setName] = useState(role?.name || '');
  const [color, setColor] = useState(role?.color || '#99AAB5');
  const [position, setPosition] = useState(role?.position || 10);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(role?.permissions || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (permissionSchema.length === 0) {
      fetchPermissionSchema();
    }
  }, [permissionSchema.length, fetchPermissionSchema]);

  const togglePermission = (perm: string) => {
    setPermissions((prev) => ({ ...prev, [perm]: !prev[perm] }));
  };

  const toggleCategory = (category: PermissionCategory) => {
    const allEnabled = category.permissions.every((p) => permissions[p]);
    const updated = { ...permissions };
    category.permissions.forEach((p) => {
      updated[p] = !allEnabled;
    });
    setPermissions(updated);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);

    if (isCreating) {
      await createRole(orgId, { name, color, position, permissions });
    } else if (role) {
      await updateRole(orgId, role.id, { name, color, position, permissions });
    }

    setSaving(false);
    onClose();
  };

  const formatPermName = (perm: string) =>
    perm.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-blue-400" />
            <h3 className="text-white font-semibold text-lg">
              {isCreating ? 'Create Role' : `Edit: ${role?.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Name & Color */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium">Role Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={role?.is_default}
              placeholder="e.g. Designer"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-gray-400 font-medium">Position (hierarchy)</label>
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              min={1}
              max={99}
              className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Permission Grid */}
          <div className="space-y-4">
            <h4 className="text-sm text-gray-400 font-medium uppercase tracking-wider">Permissions</h4>
            {permissionSchema.map((category) => {
              const allEnabled = category.permissions.every((p) => permissions[p]);
              const someEnabled = category.permissions.some((p) => permissions[p]);

              return (
                <div key={category.name} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border transition-colors flex items-center justify-center text-xs ${
                        allEnabled
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : someEnabled
                          ? 'bg-blue-500/30 border-blue-500/50 text-white'
                          : 'border-white/20'
                      }`}
                    >
                      {allEnabled && '\u2713'}
                      {someEnabled && !allEnabled && '\u2012'}
                    </div>
                    <span className="text-white font-medium text-sm">{category.name}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 pl-6">
                    {category.permissions.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <div
                          onClick={() => togglePermission(perm)}
                          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center text-xs cursor-pointer ${
                            permissions[perm]
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-white/20 group-hover:border-white/40'
                          }`}
                        >
                          {permissions[perm] && '\u2713'}
                        </div>
                        <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                          {formatPermName(perm)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isCreating ? 'Create Role' : 'Save Changes'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Wrapper that uses `key` to fully remount the inner component when the role changes,
// avoiding the need to call setState inside an effect to sync props.
export const RoleEditor: React.FC<RoleEditorProps> = (props) => {
  const editorKey = useMemo(() => props.role?.id || (props.isCreating ? 'new' : 'none'), [props.role?.id, props.isCreating]);
  return <RoleEditorInner key={editorKey} {...props} />;
};
