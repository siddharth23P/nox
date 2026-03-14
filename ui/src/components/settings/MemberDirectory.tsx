import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, UserMinus, ChevronDown, Loader2, Users, UserPlus, Plus, X } from 'lucide-react';
import { useOrgStore, type OrgMember } from '../../stores/orgStore';
import { useAuthStore } from '../../stores/authStore';
import { useRBACStore, type Role } from '../../stores/rbacStore';
import { InviteModal } from './InviteModal';

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-red-500/20 text-red-400 border-red-500/30',
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  member: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  guest: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const ROLES = ['owner', 'admin', 'member', 'guest'];

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${ROLE_COLORS[role] || ROLE_COLORS.member}`}>
    {role}
  </span>
);

const MemberRow: React.FC<{
  member: OrgMember;
  isAdmin: boolean;
  currentUserId: string;
  orgRoles: Role[];
  memberRbacRoles: Role[];
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
  onAssignRole: (userId: string, roleId: string) => void;
  onRemoveRole: (userId: string, roleId: string) => void;
}> = ({ member, isAdmin, currentUserId, orgRoles, memberRbacRoles, onRoleChange, onRemove, onAssignRole, onRemoveRole }) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showRbacMenu, setShowRbacMenu] = useState(false);
  const isSelf = member.user_id === currentUserId;

  const avatarUrl = member.avatar_url
    ? (member.avatar_url.startsWith('http') ? member.avatar_url : `http://localhost:8080${member.avatar_url}`)
    : '';

  const displayName = member.display_name || member.full_name || member.username;
  const assignedRoleIds = new Set(memberRbacRoles.map((r) => r.id));
  const unassignedRoles = orgRoles.filter((r) => !assignedRoleIds.has(r.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group"
      data-testid={`member-row-${member.user_id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={member.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-sm">
              {member.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{displayName}</span>
            {isSelf && (
              <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">you</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500">@{member.username}</span>
            {memberRbacRoles.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {memberRbacRoles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0 text-[10px] font-medium rounded-full border border-white/10"
                    style={{ color: r.color, borderColor: `${r.color}40` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}
                    {isAdmin && !isSelf && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveRole(member.user_id, r.id); }}
                        className="hover:text-red-400 ml-0.5"
                        title={`Remove ${r.name} role`}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && !isSelf && unassignedRoles.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setShowRbacMenu(!showRbacMenu); setShowRoleMenu(false); }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 transition-all"
              title="Assign RBAC role"
              data-testid={`assign-rbac-role-${member.user_id}`}
            >
              <Plus size={14} />
            </button>
            {showRbacMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[160px]">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">Assign Role</div>
                {unassignedRoles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { onAssignRole(member.user_id, r.id); setShowRbacMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-gray-300 flex items-center gap-2"
                    data-testid={`rbac-option-${r.name.toLowerCase()}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {isAdmin && !isSelf ? (
          <div className="relative">
            <button
              onClick={() => { setShowRoleMenu(!showRoleMenu); setShowRbacMenu(false); }}
              className="flex items-center gap-1 cursor-pointer"
              data-testid={`role-selector-${member.user_id}`}
            >
              <RoleBadge role={member.role} />
              <ChevronDown size={12} className="text-gray-500" />
            </button>
            {showRoleMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[120px]">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { onRoleChange(member.user_id, r); setShowRoleMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 capitalize ${r === member.role ? 'text-blue-400' : 'text-gray-300'}`}
                    data-testid={`role-option-${r}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <RoleBadge role={member.role} />
        )}
        {isAdmin && !isSelf && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRemove(member.user_id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"
            title="Remove member"
            data-testid={`remove-member-${member.user_id}`}
          >
            <UserMinus size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

export const MemberDirectory: React.FC = () => {
  const { members, totalMembers, isLoading, error, fetchMembers, changeMemberRole, removeMember } = useOrgStore();
  const { orgId, role, user } = useAuthStore();
  const { roles: orgRoles, fetchRoles, assignRole, removeRole } = useRBACStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberRoles, setMemberRoles] = useState<Record<string, Role[]>>({});
  const pageSize = 50;
  const isAdmin = role === 'owner' || role === 'admin';

  const loadMembers = useCallback(() => {
    if (orgId) { fetchMembers(orgId, search, pageSize, page * pageSize); }
  }, [orgId, search, page, fetchMembers]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { if (orgId) { fetchRoles(orgId); } }, [orgId, fetchRoles]);

  const handleSearchChange = (value: string) => { setSearch(value); setPage(0); };
  const handleRoleChange = async (userId: string, newRole: string) => { if (!orgId) return; await changeMemberRole(orgId, userId, newRole); };

  const handleRemove = async (userId: string) => {
    if (!orgId) return;
    const member = members.find(m => m.user_id === userId);
    if (member && window.confirm(`Remove @${member.username} from this organization?`)) { await removeMember(orgId, userId); }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    if (!orgId) return;
    const success = await assignRole(orgId, userId, roleId);
    if (success) {
      const assignedRole = orgRoles.find((r) => r.id === roleId);
      if (assignedRole) { setMemberRoles((prev) => ({ ...prev, [userId]: [...(prev[userId] || []), assignedRole] })); }
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!orgId) return;
    const success = await removeRole(orgId, userId, roleId);
    if (success) { setMemberRoles((prev) => ({ ...prev, [userId]: (prev[userId] || []).filter((r) => r.id !== roleId) })); }
  };

  const totalPages = Math.ceil(totalMembers / pageSize);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Members</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>{totalMembers} member{totalMembers !== 1 ? 's' : ''}</span>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              data-testid="invite-people-button"
            >
              <UserPlus size={16} />
              Invite People
            </motion.button>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal open={showInviteModal} onClose={() => setShowInviteModal(false)} />

      {/* Search Bar */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search members by name, username, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            data-testid="member-search-input" />
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        {error && (<div className="px-4 py-3 text-sm text-red-400 border-b border-white/5">{error}</div>)}
        {isLoading && members.length === 0 ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-500" /></div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">{search ? 'No members match your search' : 'No members found'}</div>
        ) : (
          <div className="divide-y divide-white/5">
            {members.map((member) => (
              <MemberRow key={member.user_id} member={member} isAdmin={isAdmin} currentUserId={user?.id || ''}
                orgRoles={orgRoles} memberRbacRoles={memberRoles[member.user_id] || []}
                onRoleChange={handleRoleChange} onRemove={handleRemove}
                onAssignRole={handleAssignRole} onRemoveRole={handleRemoveRole} />
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Previous</button>
            <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
