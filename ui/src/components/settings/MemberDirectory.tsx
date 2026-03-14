import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, UserMinus, ChevronDown, Loader2, Users } from 'lucide-react';
import { useOrgStore, type OrgMember } from '../../stores/orgStore';
import { useAuthStore } from '../../stores/authStore';

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
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
}> = ({ member, isAdmin, currentUserId, onRoleChange, onRemove }) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const isSelf = member.user_id === currentUserId;

  const avatarUrl = member.avatar_url
    ? (member.avatar_url.startsWith('http') ? member.avatar_url : `http://localhost:8080${member.avatar_url}`)
    : '';

  const displayName = member.display_name || member.full_name || member.username;

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
          <div className="text-xs text-gray-500 truncate">@{member.username}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && !isSelf ? (
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
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
                    onClick={() => {
                      onRoleChange(member.user_id, r);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 capitalize ${
                      r === member.role ? 'text-blue-400' : 'text-gray-300'
                    }`}
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const isAdmin = role === 'owner' || role === 'admin';

  const loadMembers = useCallback(() => {
    if (orgId) {
      fetchMembers(orgId, search, pageSize, page * pageSize);
    }
  }, [orgId, search, page, fetchMembers]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!orgId) return;
    await changeMemberRole(orgId, userId, newRole);
  };

  const handleRemove = async (userId: string) => {
    if (!orgId) return;
    const member = members.find(m => m.user_id === userId);
    if (member && window.confirm(`Remove @${member.username} from this organization?`)) {
      await removeMember(orgId, userId);
    }
  };

  const totalPages = Math.ceil(totalMembers / pageSize);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Members</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users size={16} />
          <span>{totalMembers} member{totalMembers !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search members by name, username, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            data-testid="member-search-input"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        {error && (
          <div className="px-4 py-3 text-sm text-red-400 border-b border-white/5">{error}</div>
        )}

        {isLoading && members.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {search ? 'No members match your search' : 'No members found'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {members.map((member) => (
              <MemberRow
                key={member.user_id}
                member={member}
                isAdmin={isAdmin}
                currentUserId={user?.id || ''}

                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
