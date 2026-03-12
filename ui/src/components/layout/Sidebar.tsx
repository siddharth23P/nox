import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { 
  Hash, 
  MessageSquare, 
  Bell, 
  Search, 
  Settings, 
  LogOut,
  ChevronDown
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
  const logout = useAuthStore((state) => state.logout);
  const { activeChannel, setActiveChannel } = useMessageStore();

  const handleChannelSelect = (id: string, name: string) => {
    setActiveChannel({
      id,
      name,
      org_id: '00000000-0000-0000-0000-000000000001',
      description: '',
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const currentChannelId = activeChannel?.id || '00000000-0000-0000-0000-000000000001';

  return (
    <div className="w-64 h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col pt-4 pb-4">
      
      {/* Org Header */}
      <motion.div 
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
        className="px-4 py-2 mx-2 mb-6 rounded-xl flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
            N
          </div>
          <span className="text-white font-semibold text-sm">Nexus Inc</span>
        </div>
        <ChevronDown size={14} className="text-gray-500 group-hover:text-white transition-colors" />
      </motion.div>

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
            <NavItem icon={Hash} text="general" active={currentChannelId === '00000000-0000-0000-0000-000000000001'} onClick={() => handleChannelSelect('00000000-0000-0000-0000-000000000001', 'general')} />
            <NavItem icon={Hash} text="engineering" active={currentChannelId === '00000000-0000-0000-0000-000000000002'} onClick={() => handleChannelSelect('00000000-0000-0000-0000-000000000002', 'engineering')} />
            <NavItem icon={Hash} text="design" active={currentChannelId === '00000000-0000-0000-0000-000000000003'} onClick={() => handleChannelSelect('00000000-0000-0000-0000-000000000003', 'design')} />
            <NavItem icon={Hash} text="random" active={currentChannelId === '00000000-0000-0000-0000-000000000004'} onClick={() => handleChannelSelect('00000000-0000-0000-0000-000000000004', 'random')} />
          </div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between group">
            <span>Direct Messages</span>
            <span className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:text-white">+</span>
          </div>
          <div className="space-y-1">
            <NavItem icon={MessageSquare} text="Alice Chen" />
            <NavItem icon={MessageSquare} text="Bob Smith" />
          </div>
        </div>

      </div>

      {/* Footer / User Profile */}
      <div className="px-3 pt-4 border-t border-white/5 space-y-1">
        <NavItem icon={Settings} text="Settings" />
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
