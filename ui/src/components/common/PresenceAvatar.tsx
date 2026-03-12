import React from 'react';
import { motion } from 'framer-motion';
import { usePresenceStore } from '../../stores/presenceStore';

interface PresenceAvatarProps {
  userId: string;
  username: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string; // Optional wrapper styles
  hideStatus?: boolean;
}

export const PresenceAvatar: React.FC<PresenceAvatarProps> = ({ 
  userId, 
  username = "?", 
  size = 'md',
  className = '',
  hideStatus = false
}) => {
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const isOnline = onlineUsers.includes(userId);

  const initial = username.charAt(0).toUpperCase();

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  const indicatorSize = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div className={`relative ${className}`}>
      {/* The Avatar body */}
      <div 
        className={`
          ${sizeClasses[size]} 
          rounded-full bg-slate-800 flex items-center justify-center 
          text-slate-100 font-medium tracking-wide
          border border-slate-700/50 shadow-inner overflow-hidden
        `}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
        <span className="relative z-10">{initial}</span>
      </div>

      {/* The Status Indicator */}
      {isOnline && !hideStatus && (
        <div className="absolute bottom-0 right-0 transform translate-x-1/4 translate-y-1/4">
          <motion.div
            className={`${indicatorSize[size]} bg-emerald-500 rounded-full border-2 border-slate-900 shadow-sm presence-indicator`}
            animate={{ 
              boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 0 4px rgba(16, 185, 129, 0.3)', '0 0 0 0 rgba(16, 185, 129, 0)'] 
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>
      )}
    </div>
  );
};
