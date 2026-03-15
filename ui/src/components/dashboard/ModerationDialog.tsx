import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, VolumeX, AlertTriangle, Ban } from 'lucide-react';
import { useModerationStore } from '../../stores/moderationStore';

interface ModerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername: string;
  channelId?: string;
}

type ActionTab = 'timeout' | 'mute' | 'warn' | 'ban';

const TIMEOUT_DURATIONS = [
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '1 hour', value: '1h' },
  { label: '1 day', value: '1d' },
  { label: '1 week', value: '1w' },
];

export const ModerationDialog: React.FC<ModerationDialogProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  channelId,
}) => {
  const [tab, setTab] = useState<ActionTab>('timeout');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1h');
  const [muteScope, setMuteScope] = useState<'channel' | 'server'>('channel');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const { timeoutUser, muteUser, warnUser, banUser } = useModerationStore();

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    setSuccess('');

    let result = null;
    switch (tab) {
      case 'timeout':
        result = await timeoutUser(targetUserId, duration, reason.trim(), channelId);
        break;
      case 'mute':
        result = await muteUser(
          targetUserId,
          reason.trim(),
          muteScope === 'channel' ? channelId : undefined
        );
        break;
      case 'warn':
        result = await warnUser(targetUserId, reason.trim());
        break;
      case 'ban':
        result = await banUser(targetUserId, reason.trim());
        break;
    }

    setIsSubmitting(false);
    if (result) {
      setSuccess(`${tab.charAt(0).toUpperCase() + tab.slice(1)} applied to ${targetUsername}`);
      setTimeout(() => {
        onClose();
        setSuccess('');
        setReason('');
      }, 1500);
    }
  };

  const tabs: { key: ActionTab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'timeout', label: 'Timeout', icon: <Clock size={14} />, color: 'text-yellow-400' },
    { key: 'mute', label: 'Mute', icon: <VolumeX size={14} />, color: 'text-orange-400' },
    { key: 'warn', label: 'Warn', icon: <AlertTriangle size={14} />, color: 'text-amber-400' },
    { key: 'ban', label: 'Ban', icon: <Ban size={14} />, color: 'text-red-400' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-base font-semibold text-gray-100">
              Moderate {targetUsername}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? `${t.color} border-b-2 border-current`
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Duration picker (timeout only) */}
            {tab === 'timeout' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {TIMEOUT_DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        duration === d.value
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mute scope (mute only) */}
            {tab === 'mute' && channelId && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Scope</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMuteScope('channel')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      muteScope === 'channel'
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    This Channel
                  </button>
                  <button
                    onClick={() => setMuteScope('server')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      muteScope === 'server'
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    Entire Server
                  </button>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a reason for this action..."
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[80px]"
              />
            </div>

            {/* Warning for ban */}
            {tab === 'ban' && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <Ban size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">
                  Banning will prevent this user from sending messages in any channel in this server.
                </p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-300 text-center">
                {success}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || isSubmitting}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tab === 'ban'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isSubmitting ? 'Applying...' : `Apply ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
