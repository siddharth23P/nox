import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X } from 'lucide-react';
import { useProfileStore, type UserProfile } from '../../stores/profileStore';

interface ProfilePopoverProps {
  userId: string;
  username: string;
  children: React.ReactNode;
}

export const ProfilePopover: React.FC<ProfilePopoverProps> = ({ userId, username, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const fetchedRef = useRef(false);
  const fetchUserProfile = useProfileStore((s) => s.fetchUserProfile);

  const loadProfile = useCallback(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchUserProfile(userId).then((p) => {
      setProfile(p);
    });
  }, [userId, fetchUserProfile]);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen, loadProfile]);

  const loading = isOpen && !profile;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const displayName = profile?.display_name || profile?.full_name || username;
  const avatarUrl = profile?.avatar_url
    ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `http://localhost:8080${profile.avatar_url}`)
    : '';

  return (
    <div className="relative inline-block">
      <button
        onClick={handleToggle}
        className="hover:underline cursor-pointer text-left"
        data-testid={`profile-popover-trigger-${userId}`}
      >
        {children}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Popover */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 z-50 w-72 bg-[#1a1a1a] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              data-testid={`profile-popover-${userId}`}
            >
              {/* Header / Avatar Banner */}
              <div className="h-16 bg-gradient-to-r from-blue-600/30 to-purple-600/30 relative">
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-2 right-2 text-white/60 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Avatar */}
              <div className="px-4 -mt-8">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-4 border-[#1a1a1a] overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-gray-500" />
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="px-4 pt-2 pb-4">
                {loading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-5 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-24 bg-white/10 rounded" />
                  </div>
                ) : (
                  <>
                    <h4 className="text-white font-semibold text-lg" data-testid="popover-display-name">
                      {displayName}
                    </h4>
                    <p className="text-gray-500 text-sm">@{profile?.username || username}</p>

                    {profile?.bio && (
                      <p className="text-gray-300 text-sm mt-3 leading-relaxed" data-testid="popover-bio">
                        {profile.bio}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-gray-600">
                        Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '...'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
