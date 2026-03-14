import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore, type Channel } from '../../stores/messageStore';
import { usePresenceStore } from '../../stores/presenceStore';
import { PresenceAvatar } from '../common/PresenceAvatar';
import {
  Hash,
  MessageSquare,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Check,
  Building2,
  Users
} from 'lucide-react';

const NavItem = ({ icon: Icon, text, active, onClick }: { icon: React.ElementType, text: string, active?: boolean, onClick?: () => void }) => (
  <motion.button
    whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full h-10 px-3 rounded-xl flex items-center gap-3 transition-colors ${
      active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
    }`}
  >
    <Icon size={18} className={active ? 'text-blue-400' : ''} />
    <span className="text-[14px] font-medium">{text}</span>
  </motion.button>
);

export const Sidebar: React.FC = () => {
  const { user, orgId, orgName, organizations, logout, fetchOrganizations, switchOrganization } = useAuthStore();
  const { activeChannel, setActiveChannel, channels, fetchChannels } = useMessageStore();
  const { isStealth, setStealth } = usePresenceStore();
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchChannels();
    fetchOrganizations();
  }, [fetchChannels, fetchOrganizations]);

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
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
          {showOrgSwitcher && organizations.length > 0 && (
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6">

        <div className="space-y-1">
          <NavItem icon={Search} text="Search" />
          <NavItem icon={Bell} text="Activity" />
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between group">
            <span>Channels</span>
            <span className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:text-white">+</span>
          </div>
          <div className="space-y-1">
            {channels.map(channel => (
              <NavItem
                key={channel.id}
                icon={Hash}
                text={channel.name}
                active={currentChannelId === channel.id}
                onClick={() => handleChannelSelect(channel)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between group">
            <span>Direct Messages</span>
            <span className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:text-white">+</span>
          </div>
          <div className="space-y-1">
            <NavItem icon={MessageSquare} text="AliceReacts" />
            <NavItem icon={MessageSquare} text="BobReacts" />
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

    </div>
  );
};
