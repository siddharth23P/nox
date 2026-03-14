import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Check Your Email">
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Reset Link Sent</h2>
          <p className="text-gray-400 max-w-[280px] mx-auto text-sm leading-relaxed">
            If an account exists for <span className="text-white font-semibold">{email}</span>, we've sent a password reset link.
          </p>
          <div className="space-y-3 pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/')}
              className="w-full h-14 bg-white text-black font-bold rounded-2xl transition-all"
            >
              Back to Login
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/account-recovery')}
              className="text-blue-500 font-bold text-sm hover:text-blue-400 transition-colors"
            >
              Try Security Questions Instead
            </motion.button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot Password">
      <div className="space-y-6">
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          Enter the email associated with your account and we'll send a reset link.
        </p>

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
              'Send Reset Link'
            )}
          </motion.button>
        </form>

        <div className="text-center space-y-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/')}
            className="text-gray-500 font-medium text-sm hover:text-white transition-colors"
          >
            Back to Login
          </motion.button>
          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/account-recovery')}
              className="text-blue-500 font-bold text-sm hover:text-blue-400 transition-colors"
            >
              Use Security Questions
            </motion.button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
