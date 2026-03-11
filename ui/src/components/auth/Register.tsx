import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

export const Register: React.FC<{ onSwitch?: () => void }> = ({ onSwitch }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [recoveryQ1, setRecoveryQ1] = useState('');
  const [recoveryA1, setRecoveryA1] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSocialLogin = (provider: string) => {
    window.location.href = `http://localhost:8080/v1/auth/${provider}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8080/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          password,
          full_name: fullName,
          org_name: orgName,
          recovery_questions: [
            { question: recoveryQ1, answer: recoveryA1 }
          ]
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title="Check your inbox" onSwitch={onSwitch}>
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Verification Link Sent</h2>
          <p className="text-gray-400 max-w-[280px] mx-auto text-sm leading-relaxed">
            We've sent a magic link to <span className="text-white font-semibold">{email}</span>. Click it to verify your account and join the Nexus.
          </p>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSwitch}
            className="text-blue-500 font-bold text-sm pt-4 hover:text-blue-400 transition-colors"
          >
            Return to Login
          </motion.button>
        </div>
      </AuthLayout>
    );
  }

  const SocialOption = ({ icon, text, provider }: { icon: string; text: string, provider: string }) => (
    <motion.button 
      whileHover={{ y: -2, backgroundColor: '#141414' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleSocialLogin(provider)}
      className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl flex items-center justify-center gap-3 transition-colors px-4 group"
    >
      <img src={icon} alt={provider} className="w-5 h-5 min-w-[20px] min-h-[20px] group-hover:scale-110 transition-transform object-contain" />
      <span className="text-[15px] font-semibold text-white/90">{text}</span>
    </motion.button>
  );

  return (
    <AuthLayout title="Create Nexus Identity" onSwitch={onSwitch}>
      <div className="space-y-3">
        <SocialOption icon="https://www.svgrepo.com/show/475656/google-color.svg" text="Continue with Google" provider="google" />
        <SocialOption icon="https://www.svgrepo.com/show/512317/github-142.svg" text="Continue with GitHub" provider="github" />
      </div>

      <div className="relative h-12 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-white/5" />
        <span className="relative z-10 px-4 bg-[#0b0b0b] text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600">or use credentials</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1">Full Name</label>
            <input
              type="text"
              placeholder="Elon"
              className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1">Username</label>
            <input
              type="text"
              placeholder="nexus_01"
              className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1">Email address</label>
          <input
            type="email"
            placeholder="name@nexus.com"
            className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1">Organization Name</label>
          <input
            type="text"
            placeholder="SpaceX"
            className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
        </div>

        <div className="pt-2 space-y-4">
          <div className="relative">
            <div className="absolute inset-x-0 h-px bg-white/5 top-1/2" />
            <span className="relative z-10 px-2 bg-[#0b0b0b] text-[9px] uppercase tracking-[0.1em] font-bold text-gray-600 ml-4">Account Recovery</span>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-500 ml-1">Security Question</label>
              <select 
                className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm appearance-none"
                value={recoveryQ1}
                onChange={(e) => setRecoveryQ1(e.target.value)}
                required
              >
                <option value="" disabled>Select a question...</option>
                <option value="first_pet">What was the name of your first pet?</option>
                <option value="mother_maiden">What is your mother's maiden name?</option>
                <option value="first_car">What was the model of your first car?</option>
                <option value="childhood_hero">Who was your childhood hero?</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-500 ml-1">Your Answer</label>
              <input
                type="text"
                placeholder="Type your secret answer..."
                className="w-full h-[48px] bg-[#0d0d0d] border border-white/5 rounded-xl px-4 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
                value={recoveryA1}
                onChange={(e) => setRecoveryA1(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs text-center font-medium bg-red-400/5 py-3 rounded-xl border border-red-400/10">
            {error}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.01, backgroundColor: '#157ad3' }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={loading}
          className="w-full h-[56px] bg-[#1d8cf8] text-white font-bold text-[16px] rounded-2xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center transition-all disabled:opacity-50 mt-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Create Nexus Identity"
          )}
        </motion.button>
      </form>
    </AuthLayout>
  );
};
