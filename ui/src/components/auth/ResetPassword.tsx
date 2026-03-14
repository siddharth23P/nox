import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reset failed');

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid Link">
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Invalid Reset Link</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
            This password reset link is missing or malformed. Please request a new one.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/forgot-password')}
            className="w-full h-14 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all"
          >
            Request New Link
          </motion.button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password Reset">
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Password Updated</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/')}
            className="w-full h-14 bg-white text-black font-bold rounded-2xl transition-all"
          >
            Continue to Login
          </motion.button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password">
      <div className="space-y-6">
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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
              'Reset Password'
            )}
          </motion.button>
        </form>
      </div>
    </AuthLayout>
  );
};
