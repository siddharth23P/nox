import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from '../../stores/authStore';
import { motion } from 'framer-motion';

export const Login: React.FC<{ onSwitch?: () => void }> = ({ onSwitch }) => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSocialLogin = (provider: string) => {
    window.location.href = `http://localhost:8080/v1/auth/${provider}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('HANDLESUBMIT CALLED');
    setLoading(true);
    setError(null);
    console.log('Sending login request to backend...');

    try {
      const response = await fetch('http://localhost:8080/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      setAuth({ id: data.user_id, email }, data.token, data.org_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
    <AuthLayout title="Welcome Back" isLogin onSwitch={onSwitch}>
      <div className="space-y-3">
        <SocialOption icon="https://www.svgrepo.com/show/475656/google-color.svg" text="Log in with Google" provider="google" />
        <SocialOption icon="https://www.svgrepo.com/show/512317/github-142.svg" text="Log in with GitHub" provider="github" />
      </div>

      <div className="relative h-12 flex items-center justify-center">
        <div className="absolute inset-x-0 h-px bg-white/5" />
        <span className="relative z-10 px-4 bg-[#0b0b0b] text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600">or</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Email address</label>
          <input
            type="email"
            placeholder="name@nexus.com"
            className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs text-center font-medium bg-red-400/5 py-2 rounded-lg border border-red-400/10">
            {error}
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.01, backgroundColor: '#157ad3' }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={loading}
          className="w-full h-[56px] bg-[#1d8cf8] text-white font-bold text-[16px] rounded-2xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Enter Nexus"
          )}
        </motion.button>
      </form>
    </AuthLayout>
  );
};
