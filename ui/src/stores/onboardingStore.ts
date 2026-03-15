import { create } from 'zustand';

const STORAGE_KEY = 'nox-onboarding-complete';

interface OnboardingStore {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  totalSteps: number;
  showTour: boolean;
  completeOnboarding: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  startTour: () => void;
  dismissTour: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => {
  let completed = false;
  try {
    completed = localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // ignore
  }

  return {
    hasCompletedOnboarding: completed,
    currentStep: 0,
    totalSteps: 5,
    showTour: false,

    completeOnboarding: () => {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      set({ hasCompletedOnboarding: true, currentStep: 0 });
    },

    setStep: (step: number) => {
      const { totalSteps } = get();
      if (step >= 0 && step < totalSteps) {
        set({ currentStep: step });
      }
    },

    nextStep: () => {
      const { currentStep, totalSteps } = get();
      if (currentStep < totalSteps - 1) {
        set({ currentStep: currentStep + 1 });
      }
    },

    prevStep: () => {
      const { currentStep } = get();
      if (currentStep > 0) {
        set({ currentStep: currentStep - 1 });
      }
    },

    startTour: () => {
      set({ showTour: true });
    },

    dismissTour: () => {
      set({ showTour: false });
    },
  };
});
