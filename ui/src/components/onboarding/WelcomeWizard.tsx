import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  User,
  Hash,
  Lightbulb,
  Rocket,
  ChevronRight,
  ChevronLeft,
  X,
  Users,
  Command,
  MessageSquareText,
  Search,
  HelpCircle,
} from 'lucide-react';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore, type BrowsableChannel } from '../../stores/messageStore';

const stepIcons = [Sparkles, User, Hash, Lightbulb, Rocket];
const stepLabels = ['Welcome', 'Profile', 'Channels', 'Tips', 'Ready'];

// --- Step Components ---

const WelcomeStep: React.FC = () => (
  <div className="flex flex-col items-center text-center px-6 py-8">
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
      <Sparkles size={36} className="text-white" />
    </div>
    <h2 className="text-3xl font-bold text-white mb-3">Welcome to Nox!</h2>
    <p className="text-gray-400 text-base max-w-sm leading-relaxed">
      Your modern workspace for team communication. Let's get you set up in just a few quick steps.
    </p>
  </div>
);

const ProfileStep: React.FC<{
  displayName: string;
  onDisplayNameChange: (val: string) => void;
}> = ({ displayName, onDisplayNameChange }) => {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col items-center text-center px-6 py-8">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-white/10 flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-white">
          {(user?.username || 'U').charAt(0).toUpperCase()}
        </span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Your Profile</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-sm">
        Confirm your display name. You can always change this later in settings.
      </p>

      <div className="w-full max-w-xs space-y-4 text-left">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Username
          </label>
          <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-400">
            {user?.username || 'unknown'}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="How should others see you?"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
            data-testid="onboarding-display-name"
          />
        </div>
      </div>
    </div>
  );
};

const ChannelsStep: React.FC = () => {
  const { browseChannels, joinChannel } = useMessageStore();
  const [channels, setChannels] = useState<BrowsableChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await browseChannels();
      setChannels(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [browseChannels]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleJoin = async (channel: BrowsableChannel) => {
    setJoiningId(channel.id);
    try {
      await joinChannel(channel.id);
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channel.id ? { ...ch, is_joined: true, member_count: ch.member_count + 1 } : ch
        )
      );
    } catch {
      // ignore
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Join Channels</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-sm text-center">
        Pick some channels to get started. You can always browse more later.
      </p>

      <div className="w-full max-w-sm max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
        {loading ? (
          <div className="text-center text-gray-500 text-sm py-8">Loading channels...</div>
        ) : channels.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">No public channels available yet</div>
        ) : (
          channels.map((channel) => (
            <motion.div
              key={channel.id}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              className="flex items-center justify-between p-3 rounded-xl"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                <Hash size={14} className="text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white truncate block">{channel.name}</span>
                  <div className="flex items-center gap-1">
                    <Users size={10} className="text-gray-600" />
                    <span className="text-[11px] text-gray-600">{channel.member_count}</span>
                  </div>
                </div>
              </div>
              {channel.is_joined ? (
                <span className="text-xs font-medium text-emerald-400 px-3 py-1.5">Joined</span>
              ) : (
                <button
                  onClick={() => handleJoin(channel)}
                  disabled={joiningId === channel.id}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors"
                  data-testid={`onboarding-join-${channel.id}`}
                >
                  {joiningId === channel.id ? '...' : 'Join'}
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const TipsStep: React.FC = () => {
  const tips = [
    { icon: Search, label: 'Quick Search', shortcut: 'Cmd+K', description: 'Search messages, channels, and people' },
    { icon: HelpCircle, label: 'Keyboard Shortcuts', shortcut: '?', description: 'View all available shortcuts' },
    { icon: MessageSquareText, label: 'Threads', shortcut: '', description: 'Click "Reply" on any message to start a thread' },
    { icon: Command, label: 'Markdown', shortcut: '', description: 'Use **bold**, *italic*, and `code` in messages' },
  ];

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Quick Tips</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-sm text-center">
        A few handy features to help you get the most out of Nox.
      </p>

      <div className="w-full max-w-sm space-y-3">
        {tips.map((tip) => (
          <div
            key={tip.label}
            className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 rounded-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <tip.icon size={16} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{tip.label}</span>
                {tip.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 border border-white/10 rounded text-gray-400">
                    {tip.shortcut}
                  </kbd>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{tip.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReadyStep: React.FC = () => (
  <div className="flex flex-col items-center text-center px-6 py-8">
    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
      <Rocket size={36} className="text-white" />
    </div>
    <h2 className="text-3xl font-bold text-white mb-3">You're All Set!</h2>
    <p className="text-gray-400 text-base max-w-sm leading-relaxed">
      You're ready to start using Nox. Jump in, explore channels, and start collaborating with your team.
    </p>
  </div>
);

// --- Main Wizard ---

export const WelcomeWizard: React.FC = () => {
  const { currentStep, totalSteps, nextStep, prevStep, completeOnboarding, startTour } =
    useOnboardingStore();
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.fullName || user?.username || '');

  const steps = [
    <WelcomeStep key="welcome" />,
    <ProfileStep key="profile" displayName={displayName} onDisplayNameChange={setDisplayName} />,
    <ChannelsStep key="channels" />,
    <TipsStep key="tips" />,
    <ReadyStep key="ready" />,
  ];

  const handleSkip = () => {
    completeOnboarding();
  };

  const handleFinish = () => {
    completeOnboarding();
    startTour();
  };

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            {stepIcons.map((Icon, i) => (
              <button
                key={i}
                onClick={() => useOnboardingStore.getState().setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  i === currentStep
                    ? 'bg-blue-500 text-white scale-110'
                    : i < currentStep
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-white/5 text-gray-600'
                }`}
                title={stepLabels[i]}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            data-testid="onboarding-skip"
          >
            <X size={14} />
            Skip
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 pb-2">
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="relative min-h-[340px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              {steps[currentStep]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          <button
            onClick={prevStep}
            disabled={isFirstStep}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isFirstStep
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            data-testid="onboarding-back"
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
              data-testid="onboarding-finish"
            >
              <Rocket size={16} />
              Start Using Nox
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center gap-1 px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
              data-testid="onboarding-next"
            >
              {isFirstStep ? 'Get Started' : 'Next'}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
