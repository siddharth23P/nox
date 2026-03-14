import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, Bell, BellOff, Mail, Volume2 } from 'lucide-react';
import { useProfileStore, type UserPreferences } from '../../stores/profileStore';

const ThemeOption = ({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
      active
        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
    }`}
    data-testid={`theme-${value}`}
  >
    <Icon size={24} />
    <span className="text-sm font-medium">{label}</span>
  </motion.button>
);

const Toggle = ({
  enabled,
  onToggle,
  testId,
}: {
  enabled: boolean;
  onToggle: () => void;
  testId?: string;
}) => (
  <button
    onClick={onToggle}
    className={`w-11 h-6 rounded-full relative transition-colors ${
      enabled ? 'bg-blue-600' : 'bg-gray-700'
    }`}
    data-testid={testId}
  >
    <motion.div
      layout
      className="w-4 h-4 bg-white rounded-full absolute top-1"
      animate={{ left: enabled ? '24px' : '4px' }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

export const PreferencesSettings: React.FC = () => {
  const { preferences, fetchPreferences, updatePreferences } = useProfileStore();

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const theme = preferences?.theme || 'dark';

  const handleThemeChange = (newTheme: string) => {
    updatePreferences({ theme: newTheme as 'dark' | 'light' | 'system' });
  };

  const handleToggle = (key: string, currentValue: boolean) => {
    updatePreferences({ [key]: !currentValue } as Partial<UserPreferences>);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-white mb-6">Preferences</h2>

      {/* Theme Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Theme</h3>
        <div className="flex gap-3">
          <ThemeOption icon={Moon} label="Dark" value="dark" active={theme === 'dark'} onClick={() => handleThemeChange('dark')} />
          <ThemeOption icon={Sun} label="Light" value="light" active={theme === 'light'} onClick={() => handleThemeChange('light')} />
          <ThemeOption icon={Monitor} label="System" value="system" active={theme === 'system'} onClick={() => handleThemeChange('system')} />
        </div>
      </div>

      {/* Notification Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className="text-gray-400" />
              <div>
                <p className="text-sm text-white font-medium">Sound Notifications</p>
                <p className="text-xs text-gray-500">Play a sound when you receive a message</p>
              </div>
            </div>
            <Toggle
              enabled={preferences?.notification_sound ?? true}
              onToggle={() => handleToggle('notification_sound', preferences?.notification_sound ?? true)}
              testId="toggle-notification-sound"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-gray-400" />
              <div>
                <p className="text-sm text-white font-medium">Desktop Notifications</p>
                <p className="text-xs text-gray-500">Show browser notifications for new messages</p>
              </div>
            </div>
            <Toggle
              enabled={preferences?.notification_desktop ?? true}
              onToggle={() => handleToggle('notification_desktop', preferences?.notification_desktop ?? true)}
              testId="toggle-notification-desktop"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-gray-400" />
              <div>
                <p className="text-sm text-white font-medium">Email Notifications</p>
                <p className="text-xs text-gray-500">Receive email digests for missed messages</p>
              </div>
            </div>
            <Toggle
              enabled={preferences?.notification_email ?? false}
              onToggle={() => handleToggle('notification_email', preferences?.notification_email ?? false)}
              testId="toggle-notification-email"
            />
          </div>
        </div>
      </div>

      {/* Do Not Disturb Section */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Do Not Disturb</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellOff size={18} className="text-gray-400" />
            <div>
              <p className="text-sm text-white font-medium">Enable DND</p>
              <p className="text-xs text-gray-500">Mute all notifications during quiet hours</p>
            </div>
          </div>
          <Toggle
            enabled={preferences?.dnd_enabled ?? false}
            onToggle={() => handleToggle('dnd_enabled', preferences?.dnd_enabled ?? false)}
            testId="toggle-dnd"
          />
        </div>
      </div>
    </motion.div>
  );
};
