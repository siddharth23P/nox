import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Link2, Mail, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useInvitationStore } from '../../stores/invitationStore';
import type { Invitation, InviteLink } from '../../stores/invitationStore';

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ open, onClose }) => {
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

  const [activeTab, setActiveTab] = useState<'link' | 'email'>('link');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [maxUses, setMaxUses] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    if (open && orgId && isAdmin) {
      fetchInvitations(orgId);
    }
  }, [open, orgId, isAdmin, fetchInvitations]);

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

  const getJoinUrl = (code: string) => {
    const base = window.location.origin;
    return `${base}/join/${code}`;
  };

  const getTokenUrl = (token: string) => {
    const base = window.location.origin;
    return `${base}/join/accept?token=${token}`;
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const d = new Date(expiresAt);
    const now = new Date();
    if (d < now) return 'Expired';
    const diffHours = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Less than 1h';
    if (diffHours < 24) return `${diffHours}h left`;
    return `${Math.round(diffHours / 24)}d left`;
  };

  const activeLinks = inviteLinks.filter((l) => l.active);
  const inactiveLinks = inviteLinks.filter((l) => !l.active);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-lg max-h-[85vh] bg-[#0b0b0b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col"
            data-testid="invite-modal"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Invite People</h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                data-testid="invite-modal-close"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Tab Switcher */}
            <div className="px-5 pt-4">
              <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('link')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'link'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Link2 size={14} />
                  Invite Link
                </button>
                <button
                  onClick={() => setActiveTab('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'email'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Mail size={14} />
                  Direct Invite
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

              {/* INVITE LINK TAB */}
              {activeTab === 'link' && (
                <>
                  {/* Create Link Form */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        >
                          <option value="member">Member</option>
                          <option value="guest">Guest</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Max uses
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="No limit"
                          value={maxUses}
                          onChange={(e) => setMaxUses(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Expires (hrs)
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Never"
                          value={expiresInHours}
                          onChange={(e) => setExpiresInHours(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleCreateLink}
                      disabled={isLoading}
                      className="w-full h-[40px] bg-[#1d8cf8] text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Link2 size={14} />
                          Generate Invite Link
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Active Links */}
                  {activeLinks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Active Links ({activeLinks.length})
                      </h3>
                      {activeLinks.map((link: InviteLink) => (
                        <motion.div
                          key={link.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/[0.03] border border-white/5 rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-xs font-mono truncate">
                                {getJoinUrl(link.code)}
                              </p>
                              <div className="flex gap-2 mt-1.5 text-[10px] text-gray-500">
                                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-semibold">
                                  {link.role}
                                </span>
                                <span>
                                  {link.use_count}{link.max_uses ? `/${link.max_uses}` : ''} uses
                                </span>
                                <span>{formatExpiry(link.expires_at)}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard(getJoinUrl(link.code), link.id)}
                                className="p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                title="Copy link"
                              >
                                {copied === link.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => orgId && revokeInviteLink(orgId, link.id)}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Revoke link"
                              >
                                <Trash2 size={14} />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Inactive Links */}
                  {inactiveLinks.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Revoked Links ({inactiveLinks.length})
                      </h3>
                      {inactiveLinks.map((link: InviteLink) => (
                        <div
                          key={link.id}
                          className="bg-white/[0.02] border border-white/5 rounded-xl p-3 opacity-50"
                        >
                          <p className="text-gray-500 text-xs font-mono truncate">
                            {getJoinUrl(link.code)}
                          </p>
                          <div className="flex gap-2 mt-1.5 text-[10px] text-gray-600">
                            <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-500 rounded font-semibold">
                              Revoked
                            </span>
                            <span>{link.use_count} uses</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeLinks.length === 0 && inactiveLinks.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">
                      No invite links yet. Generate one above.
                    </p>
                  )}
                </>
              )}

              {/* DIRECT INVITE (EMAIL) TAB */}
              {activeTab === 'email' && (
                <>
                  {/* Create Invitation Form */}
                  <form onSubmit={handleCreateInvitation} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                        Email address
                      </label>
                      <input
                        type="email"
                        placeholder="colleague@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-sm"
                        data-testid="invite-email-input"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        >
                          <option value="member">Member</option>
                          <option value="guest">Guest</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Max uses
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="No limit"
                          value={maxUses}
                          onChange={(e) => setMaxUses(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                          Expires (hrs)
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Never"
                          value={expiresInHours}
                          onChange={(e) => setExpiresInHours(e.target.value)}
                          className="w-full h-[40px] bg-[#0d0d0d] border border-white/5 rounded-lg px-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
                        />
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[40px] bg-[#1d8cf8] text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Mail size={14} />
                          Send Invitation
                        </>
                      )}
                    </motion.button>
                  </form>

                  {/* Pending Invitations List */}
                  {invitations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Pending Invitations ({invitations.length})
                      </h3>
                      {invitations.map((inv: Invitation) => (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/[0.03] border border-white/5 rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-sm font-medium truncate">{inv.email}</p>
                              <div className="flex gap-2 mt-1 text-[10px] text-gray-500">
                                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded font-semibold">
                                  {inv.role}
                                </span>
                                <span>
                                  {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''} uses
                                </span>
                                <span>{formatExpiry(inv.expires_at)}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard(getTokenUrl(inv.token), inv.id)}
                                className="p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                title="Copy invite link"
                              >
                                {copied === inv.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => orgId && revokeInvitation(orgId, inv.id)}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Revoke invitation"
                              >
                                <Trash2 size={14} />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {invitations.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">
                      No pending email invitations.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
