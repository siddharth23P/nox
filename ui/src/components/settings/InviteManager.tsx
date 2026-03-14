import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useInvitationStore } from '../../stores/invitationStore';
import type { Invitation, InviteLink } from '../../stores/invitationStore';

export const InviteManager: React.FC = () => {
  const { orgId, role } = useAuthStore();
  const {
    invitations,
    inviteLinks,
    isLoading,
    error,
    fetchInvitations,
    createInvitation,
    createInviteLink,
    revokeInvitation,
    revokeInviteLink,
  } = useInvitationStore();

  const [activeTab, setActiveTab] = useState<'email' | 'link'>('email');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [maxUses, setMaxUses] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (orgId && isAdmin) {
      fetchInvitations(orgId);
    }
  }, [orgId, isAdmin, fetchInvitations]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !email) return;

    const mu = maxUses ? parseInt(maxUses) : undefined;
    const eh = expiresInHours ? parseInt(expiresInHours) : undefined;

    const result = await createInvitation(orgId, email, inviteRole, mu, eh);
    if (result) {
      setEmail('');
      setMaxUses('');
      setExpiresInHours('');
      setSuccessMsg(`Invitation sent to ${email}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleCreateLink = async () => {
    if (!orgId) return;

    const mu = maxUses ? parseInt(maxUses) : undefined;
    const eh = expiresInHours ? parseInt(expiresInHours) : undefined;

    const result = await createInviteLink(orgId, inviteRole, mu, eh);
    if (result) {
      setMaxUses('');
      setExpiresInHours('');
      setSuccessMsg('Invite link created');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Only admins can manage invitations.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-white"
      >
        Invite Members
      </motion.h2>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(['email', 'link'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'email' ? 'Email Invite' : 'Invite Link'}
          </button>
        ))}
      </div>

      {/* Success / Error Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-green-400 text-sm text-center font-medium bg-green-400/10 py-2 rounded-lg border border-green-400/20"
          >
            {successMsg}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg border border-red-400/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Form */}
      <motion.div
        layout
        className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4"
      >
        {activeTab === 'email' && (
          <form onSubmit={handleCreateInvitation} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                Email address
              </label>
              <input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                >
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Max uses
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Expires (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Never"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                />
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-[48px] bg-[#1d8cf8] text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Send Invitation'
              )}
            </motion.button>
          </form>
        )}

        {activeTab === 'link' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                >
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Max uses
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Expires (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Never"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                />
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleCreateLink}
              disabled={isLoading}
              className="w-full h-[48px] bg-[#1d8cf8] text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Generate Invite Link'
              )}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Existing Invitations List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          Email Invitations ({invitations.length})
        </h3>
        <AnimatePresence>
          {invitations.length === 0 ? (
            <p className="text-gray-600 text-sm">No email invitations yet.</p>
          ) : (
            invitations.map((inv: Invitation) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="text-white text-sm font-medium">{inv.email}</p>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-semibold">
                      {inv.role}
                    </span>
                    <span>Uses: {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''}</span>
                    {inv.expires_at && (
                      <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(`http://localhost:5173/join/accept?token=${inv.token}`, inv.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    {copied === inv.id ? 'Copied!' : 'Copy Link'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => orgId && revokeInvitation(orgId, inv.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Revoke
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Existing Invite Links List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          Invite Links ({inviteLinks.length})
        </h3>
        <AnimatePresence>
          {inviteLinks.length === 0 ? (
            <p className="text-gray-600 text-sm">No invite links yet.</p>
          ) : (
            inviteLinks.map((link: InviteLink) => (
              <motion.div
                key={link.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <p className="text-white text-sm font-mono">
                    localhost:5173/join/{link.code}
                  </p>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-md font-semibold ${
                      link.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {link.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-semibold">
                      {link.role}
                    </span>
                    <span>Uses: {link.use_count}{link.max_uses ? `/${link.max_uses}` : ''}</span>
                    {link.expires_at && (
                      <span>Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(`http://localhost:5173/join/${link.code}`, link.id)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    {copied === link.id ? 'Copied!' : 'Copy'}
                  </motion.button>
                  {link.active && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => orgId && revokeInviteLink(orgId, link.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Revoke
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
