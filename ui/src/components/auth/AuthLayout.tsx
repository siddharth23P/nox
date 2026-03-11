import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  isLogin?: boolean;
  onSwitch?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, isLogin, onSwitch }) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
         <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
         <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <nav className="absolute top-0 w-full px-8 h-20 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-gradient-to-tr from-[#1d8cf8] to-[#12c2e9] flex items-center justify-center p-2 shadow-lg shadow-blue-500/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white/90">nox</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onSwitch}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
          {!isLogin && (
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors">
              Sign up
            </button>
          )}
        </div>
      </nav>

      {/* Auth Card Container */}
      <main className="relative z-10 w-full max-w-[440px] px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="bg-[#0b0b0b] border border-white/10 rounded-[28px] p-10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm"
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
            <p className="text-gray-500 text-sm">Welcome to the future of collaboration</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Footer Legal */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-gray-600 leading-relaxed uppercase tracking-wider font-semibold">
            By continuing, you agree to Nox's <br />
            <a href="#" className="text-gray-500 hover:text-blue-400 transition-colors">Terms of Service</a> & <a href="#" className="text-gray-500 hover:text-blue-400 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </main>
    </div>
  );
};
