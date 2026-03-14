import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SECURITY_QUESTIONS: Record<string, string> = {
  first_pet: 'What was the name of your first pet?',
  mother_maiden: "What is your mother's maiden name?",
  first_car: 'What was the model of your first car?',
  childhood_hero: 'Who was your childhood hero?',
};

export const AccountRecovery: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/v1/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          answers: [{ question, answer }],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Recovery failed');

      setResetToken(data.reset_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    return (
      <AuthLayout title="Identity Verified">
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Security Verified</h2>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
            Your identity has been verified. You can now set a new password.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/reset-password?token=${resetToken}`)}
            className="w-full h-14 bg-white text-black font-bold rounded-2xl transition-all"
          >
            Set New Password
          </motion.button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Account Recovery">
      <div className="space-y-6">
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          Verify your identity using the security question you set during registration.
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

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Security Question</label>
            <select
              className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium appearance-none"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            >
              <option value="" disabled>Select your security question...</option>
              {Object.entries(SECURITY_QUESTIONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Your Answer</label>
            <input
              type="text"
              placeholder="Type your secret answer..."
              className="w-full h-[54px] bg-[#0d0d0d] border border-white/5 rounded-2xl px-5 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
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
              'Verify Identity'
            )}
          </motion.button>
        </form>

        <div className="text-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/forgot-password')}
            className="text-gray-500 font-medium text-sm hover:text-white transition-colors"
          >
            Use Email Reset Instead
          </motion.button>
        </div>
      </div>
    </AuthLayout>
  );
};
