import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore, type Channel, type DMConversation } from '../../stores/messageStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { PresenceAvatar } from '../common/PresenceAvatar';
import {
  Hash,
  Lock,
  MessageSquare,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Check,
  Building2,
  Users,
  Plus,
  Archive,
  X,
  Compass,
  Shield
} from 'lucide-react';
import CreateChannelModal from '../dashboard/CreateChannelModal';
import BrowseChannelsModal from '../dashboard/BrowseChannelsModal';
import CreateOrgModal from '../dashboard/CreateOrgModal';

const NavItem = ({ icon: Icon, text, active, onClick }: { icon: React.ElementType, text: string, active?: boolean, onClick?: () => void }) => (
  <motion.button
    whileHover={{ x: 4 }}
    whileTap={{ scale: 0.98 }}
    animate={{ backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)' }}
    onClick={onClick}
    className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/5 ${
      active ? 'text-white' : 'text-gray-400 hover:text-white'
    }`}
  >
    <Icon size={18} className={active ? 'text-blue-400' : ''} />
    <span className="text-[14px] font-medium truncate">{text}</span>
  </motion.button>
);

// --- New DM Modal (Issue #113) ---
const NewDMModal: React.FC<{ isOpen: boolean; onClose: () => void; onSelect: (userId: string, username: string) => void }> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const token = localStorage.getItem('nox_token') || '';
      const res = await fetch(`http://localhost:8080/v1/users/search?q=${encodeURIComponent(q)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': JSON.parse(localStorage.getItem('nox_user') || '{}').id || '',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore search errors
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const currentUserId = JSON.parse(localStorage.getItem('nox_user') || '{}').id || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-400" />
                New Direct Message
              </h3>
              <button
                onClick={onClose}
                title="Close"
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name or email..."
                autoFocus
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
                data-testid="dm-user-search-input"
              />

              <div className="max-h-60 overflow-y-auto space-y-1">
                {searching && (
                  <div className="text-center text-gray-500 text-sm py-4">Searching...</div>
                )}
                {!searching && query.length >= 2 && results.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-4">No users found</div>
                )}
                {results
                  .filter(u => u.id !== currentUserId)
                  .map(u => (
                    <motion.button
                      key={u.id}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      onClick={() => { onSelect(u.id, u.username); onClose(); }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left"
                      data-testid={`dm-user-${u.username}`}
                    >
                      <PresenceAvatar userId={u.id} username={u.username} size="sm" />
                      <div>
                        <div className="text-sm text-white font-medium">{u.username}</div>
                        <div className="text-[11px] text-gray-500">{u.email}</div>
                      </div>
                    </motion.button>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Sidebar: React.FC = () => {
  const { user, orgId, orgName, organizations, logout, fetchOrganizations, switchOrganization } = useAuthStore();
  const { activeChannel, setActiveChannel, channels, fetchChannels, fetchJoinedChannels, dmConversations, fetchDMs, createOrGetDM, fetchMessages } = useMessageStore();
  const { onlineUsers, isStealth, setStealth } = usePresenceStore();
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showBrowseChannels, setShowBrowseChannels] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Try to load joined channels first; fall back to all channels
    fetchJoinedChannels().then(() => {
      // If no joined channels were loaded, fall back to fetchChannels
      const currentChannels = useMessageStore.getState().channels;
      if (currentChannels.length === 0) {
        fetchChannels();
      }
    });
    fetchOrganizations();
    fetchDMs();
  }, [fetchChannels, fetchJoinedChannels, fetchOrganizations, fetchDMs]);

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
    navigate('/dashboard');
  };

  const handleDMSelect = (dm: DMConversation) => {
    // Treat the DM's backing channel as the active channel
    const dmChannel: Channel = {
      id: dm.channel_id,
      org_id: '',
      name: dm.username,
      is_private: true,
      created_at: dm.created_at,
      updated_at: dm.created_at,
    };
    setActiveChannel(dmChannel);
    fetchMessages(dm.channel_id);
    navigate('/dashboard');
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleNewDM = async (userId: string, _username: string) => {
    try {
      const dm = await createOrGetDM(userId);
      handleDMSelect(dm);
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  const handleOrgSwitch = (newOrgId: string) => {
    if (newOrgId !== orgId) {
      switchOrganization(newOrgId);
    }
    setShowOrgSwitcher(false);
  };

  const currentChannelId = activeChannel?.id || '00000000-0000-0000-0000-000000000001';
  const displayOrgName = orgName || 'Nox Workspace';

  return (
    <div className="w-64 h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col pt-4 pb-4">

      {/* Org Header with Switcher */}
      <div className="relative px-2 mb-6">
        <motion.button
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
          className="w-full px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer group"
          data-testid="org-switcher-button"
        >
          <div className="flex items-center gap-3">
            {user ? (
              <PresenceAvatar userId={user.id} username={user.username || 'U'} size="sm" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                {displayOrgName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white font-semibold text-sm truncate max-w-[140px]">{displayOrgName}</span>
          </div>
          <motion.div animate={{ rotate: showOrgSwitcher ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-gray-500 group-hover:text-white transition-colors" />
          </motion.div>
        </motion.button>

        {/* Org Switcher Dropdown */}
        <AnimatePresence>
          {showOrgSwitcher && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-2 right-2 mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
              data-testid="org-switcher-dropdown"
            >
              <div className="p-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 px-3">
                Your Organizations
              </div>
              {organizations.map(org => (
                <motion.button
                  key={org.id}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  onClick={() => handleOrgSwitch(org.id)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left"
                  data-testid={`org-option-${org.id}`}
                >
                  <div>
                    <div className="text-sm text-white font-medium">{org.name}</div>
                    <div className="text-[11px] text-gray-500 capitalize">{org.role}</div>
                  </div>
                  {org.id === orgId && (
                    <Check size={16} className="text-emerald-400" />
                  )}
                </motion.button>
              ))}
              <div className="border-t border-white/5">
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  onClick={() => { setShowOrgSwitcher(false); setShowCreateOrg(true); }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="create-org-btn"
                >
                  <Plus size={16} />
                  <span className="font-medium">Create Organization</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6">

        <div className="space-y-1">
          <NavItem icon={Search} text="Search" />
          <NavItem icon={Bell} text="Activity" />
          <NavItem
            icon={Users}
            text="Friends"
            active={location.pathname.includes('/friends')}
            onClick={() => navigate('/dashboard/friends')}
          />
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between group">
            <span>Channels</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowBrowseChannels(true)}
                className="cursor-pointer hover:text-white"
                title="Browse Channels"
                data-testid="browse-channels-btn"
              >
                <Compass size={14} />
              </button>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="cursor-pointer hover:text-white"
                title="Create Channel"
                data-testid="create-channel-btn"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {channels.map(channel => {
              const isArchived = !!(channel as Channel & { archived_at?: string }).archived_at;
              const channelIcon = channel.is_private ? Lock : isArchived ? Archive : Hash;
              return (
                <div key={channel.id} className={isArchived ? 'opacity-50' : ''}>
                  <NavItem
                    icon={channelIcon}
                    text={channel.name}
                    active={currentChannelId === channel.id}
                    onClick={() => handleChannelSelect(channel)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between group">
            <span>Direct Messages</span>
            <button
              onClick={() => setShowNewDM(true)}
              className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
              title="New Direct Message"
              data-testid="new-dm-btn"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {dmConversations.map(dm => {
              const isOnline = onlineUsers.includes(dm.user_id);
              return (
                <motion.button
                  key={dm.id}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  animate={{ backgroundColor: currentChannelId === dm.channel_id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0)' }}
                  onClick={() => handleDMSelect(dm)}
                  className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-white/5 ${
                    currentChannelId === dm.channel_id ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  data-testid={`dm-${dm.username}`}
                >
                  <div className="relative">
                    <MessageSquare size={18} className={currentChannelId === dm.channel_id ? 'text-blue-400' : ''} />
                    {isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0d0d0d]" />
                    )}
                  </div>
                  <span className="text-[14px] font-medium truncate">{dm.username}</span>
                </motion.button>
              );
            })}
            {dmConversations.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-600">No conversations yet</div>
            )}
          </div>
        </div>

      </div>

      {/* Footer / User Profile */}
      <div className="px-3 pt-4 border-t border-white/5 space-y-1">
        {/* Stealth Toggle */}
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">Stealth Mode</span>
          <button
            title="Toggle Stealth Mode"
            aria-label="Toggle Stealth Mode"
            onClick={() => setStealth(!isStealth)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              isStealth ? 'bg-emerald-500/80' : 'bg-gray-700'
            }`}
          >
            <motion.div
              layout
              className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px]"
              animate={{
                left: isStealth ? '22px' : '4px'
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        <NavItem
          icon={Building2}
          text="Org Settings"
          active={location.pathname.includes('/settings/organization')}
          onClick={() => navigate('/dashboard/settings/organization')}
        />
        <NavItem
          icon={Users}
          text="Members"
          active={location.pathname.includes('/settings/members')}
          onClick={() => navigate('/dashboard/settings/members')}
        />
        <NavItem
          icon={Shield}
          text="Roles"
          active={location.pathname.includes('/settings/roles')}
          onClick={() => navigate('/dashboard/settings/roles')}
        />
        <NavItem
          icon={Settings}
          text="Settings"
          active={location.pathname.includes('/settings/profile') || location.pathname.includes('/settings/preferences')}
          onClick={() => navigate('/dashboard/settings/profile')}
        />
        <motion.button
          whileHover={{ x: 4, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => logout()}
          className="w-full h-10 px-3 rounded-xl flex items-center gap-3 text-red-400/80 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-[14px] font-medium">Log out</span>
        </motion.button>
      </div>

      <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} />
      <NewDMModal isOpen={showNewDM} onClose={() => setShowNewDM(false)} onSelect={handleNewDM} />
      <BrowseChannelsModal isOpen={showBrowseChannels} onClose={() => setShowBrowseChannels(false)} />
      <CreateOrgModal isOpen={showCreateOrg} onClose={() => setShowCreateOrg(false)} />
    </div>
  );
};
