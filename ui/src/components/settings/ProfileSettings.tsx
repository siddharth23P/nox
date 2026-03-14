import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Loader2, User } from 'lucide-react';
import { useProfileStore } from '../../stores/profileStore';

export const ProfileSettings: React.FC = () => {
  const { profile, isLoading, error, fetchProfile, updateProfile, uploadAvatar } = useProfileStore();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Derive initial values from profile, allow local overrides
  const effectiveDisplayName = displayName ?? (profile?.display_name || '');
  const effectiveBio = bio ?? (profile?.bio || '');

  const handleSave = async () => {
    try {
      await updateProfile({ display_name: effectiveDisplayName, bio: effectiveBio });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error is set in store
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Avatar must be 2MB or less');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Avatar must be JPEG, PNG, or WebP');
      return;
    }

    try {
      await uploadAvatar(file);
    } catch {
      setUploadError('Failed to upload avatar');
    }
  };

  const avatarUrl = profile?.avatar_url
    ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `http://localhost:8080${profile.avatar_url}`)
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>

      {/* Avatar Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Avatar</h3>
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAvatarClick}
            className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 hover:border-blue-500/50 transition-colors overflow-hidden group"
            data-testid="avatar-upload-button"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={32} className="text-gray-500 mx-auto" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
          </motion.button>
          <div>
            <p className="text-sm text-gray-300">Click to upload a new avatar</p>
            <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP. Max 2MB.</p>
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            data-testid="avatar-file-input"
          />
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Profile Information</h3>

        <div className="space-y-4">
          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
            <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm">
              {profile?.username || '...'}
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm">
              {profile?.email || '...'}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
            <input
              type="text"
              value={effectiveDisplayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              placeholder="How others see you"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              data-testid="display-name-input"
            />
            <p className="text-xs text-gray-600 mt-1">{effectiveDisplayName.length}/100</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Bio / Status</label>
            <textarea
              value={effectiveBio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell others about yourself..."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              data-testid="bio-input"
            />
            <p className="text-xs text-gray-600 mt-1">{effectiveBio.length}/500</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="flex justify-end mt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            data-testid="save-profile-button"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <Check size={16} />
            ) : null}
            {saved ? 'Saved!' : 'Save Changes'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
