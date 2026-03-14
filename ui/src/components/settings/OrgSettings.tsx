import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Loader2, Building2 } from 'lucide-react';
import { useOrgStore } from '../../stores/orgStore';
import { useAuthStore } from '../../stores/authStore';

export const OrgSettings: React.FC = () => {
  const { settings, isLoading, error, fetchSettings, updateSettings, uploadLogo } = useOrgStore();
  const { orgId, role } = useAuthStore();
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (orgId) {
      fetchSettings(orgId);
    }
  }, [orgId, fetchSettings]);

  const effectiveName = name ?? (settings?.name || '');
  const effectiveDescription = description ?? (settings?.description || '');

  const handleSave = async () => {
    if (!orgId) return;
    try {
      await updateSettings(orgId, { name: effectiveName, description: effectiveDescription });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error is set in store
    }
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setUploadError('');

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Logo must be 2MB or less');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Logo must be JPEG, PNG, or WebP');
      return;
    }

    try {
      await uploadLogo(orgId, file);
    } catch {
      setUploadError('Failed to upload logo');
    }
  };

  const logoUrl = settings?.logo_url
    ? (settings.logo_url.startsWith('http') ? settings.logo_url : `http://localhost:8080${settings.logo_url}`)
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-white mb-6">Organization Settings</h2>

      {/* Logo Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Logo</h3>
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogoClick}
            disabled={!isAdmin}
            className="relative w-20 h-20 rounded-2xl bg-slate-800 border-2 border-white/10 hover:border-blue-500/50 transition-colors overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="logo-upload-button"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Org Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 size={32} className="text-gray-500 mx-auto" />
            )}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
            )}
          </motion.button>
          <div>
            <p className="text-sm text-gray-300">
              {isAdmin ? 'Click to upload a new logo' : 'Organization logo'}
            </p>
            <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP. Max 2MB.</p>
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            data-testid="logo-file-input"
          />
        </div>
      </div>

      {/* Org Info Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Organization Information</h3>

        <div className="space-y-4">
          {/* Slug (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
            <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm">
              {settings?.slug || '...'}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={effectiveName}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={!isAdmin}
              placeholder="Organization name"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="org-name-input"
            />
            <p className="text-xs text-gray-600 mt-1">{effectiveName.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={effectiveDescription}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={!isAdmin}
              placeholder="Tell people about this organization..."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="org-description-input"
            />
            <p className="text-xs text-gray-600 mt-1">{effectiveDescription.length}/500</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        {isAdmin && (
          <div className="flex justify-end mt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="save-org-button"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saved ? (
                <Check size={16} />
              ) : null}
              {saved ? 'Saved!' : 'Save Changes'}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
