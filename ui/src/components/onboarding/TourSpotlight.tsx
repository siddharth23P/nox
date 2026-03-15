import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { useOnboardingStore } from '../../stores/onboardingStore';

interface TourStep {
  target: string; // CSS selector or data-testid value
  title: string;
  description: string;
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: 'Navigation Hub',
    description:
      'This is your navigation hub. Find channels, DMs, and settings here.',
  },
  {
    target: '[data-tour="channel-list"]',
    title: 'Channel List',
    description:
      'Click a channel to start chatting. Create new ones with the + button.',
  },
  {
    target: '[data-tour="message-input"]',
    title: 'Message Input',
    description:
      'Type your message here. Use markdown for formatting.',
  },
  {
    target: '[data-tour="thread-hint"]',
    title: 'Threads',
    description:
      'Click "Reply" on any message to start a thread.',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TourSpotlight: React.FC = () => {
  const { dismissTour } = useOnboardingStore();
  const [step, setStep] = useState(0);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const currentTourStep = tourSteps[step];

  // Compute rect directly during render (no effect needed)
  const getRect = useCallback((): SpotlightRect | null => {
    if (!currentTourStep) return null;
    const el = document.querySelector(currentTourStep.target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 };
  }, [currentTourStep]);

  const rect = getRect();

  useEffect(() => {
    const handleResize = () => forceUpdate();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      dismissTour();
    }
  };

  const isLastStep = step === tourSteps.length - 1;

  // Determine tooltip position relative to the spotlight
  const getTooltipPosition = (): React.CSSProperties => {
    if (!rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const viewportWidth = window.innerWidth;
    const tooltipWidth = 320;

    // Place tooltip to the right of the element if room, otherwise below
    if (rect.left + rect.width + tooltipWidth + 24 < viewportWidth) {
      return {
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width + 16,
        transform: 'translateY(-50%)',
      };
    }

    return {
      top: rect.top + rect.height + 16,
      left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
      transform: 'none',
    };
  };

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Semi-transparent overlay with spotlight cutout via CSS clip-path */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Spotlight border ring */}
      {rect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute rounded-xl border-2 border-blue-500/60 pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          layoutId="spotlight-ring"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      {/* Click catcher for dismiss */}
      <div className="absolute inset-0" onClick={dismissTour} />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl p-5 z-[201]"
          style={getTooltipPosition()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Step {step + 1} of {tourSteps.length}
            </span>
            <button
              onClick={dismissTour}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
              title="Skip tour"
              data-testid="tour-skip"
            >
              <X size={14} />
            </button>
          </div>

          <h3 className="text-base font-semibold text-white mb-1">{currentTourStep.title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">{currentTourStep.description}</p>

          {/* Step dots + next button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {tourSteps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? 'bg-blue-500' : i < step ? 'bg-blue-500/40' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              data-testid="tour-next"
            >
              {isLastStep ? 'Done' : 'Next'}
              {!isLastStep && <ChevronRight size={14} />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
