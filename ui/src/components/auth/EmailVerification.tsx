import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { motion, AnimatePresence } from 'framer-motion';

export const EmailVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your identity...');

  const token = searchParams.get('token');
  const hasVerified = React.useRef(false);

  useEffect(() => {
    if (!token || hasVerified.current) {
      return;
    }
    hasVerified.current = true;

    const verify = async () => {
      try {
        const response = await fetch(`http://localhost:8080/v1/auth/verify?token=${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setMessage('Welcome to the Nexus. Your email has been verified.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may be expired.');
        }
      } catch {
        setStatus('error');
        setMessage('Unable to connect to Nexus services.');
      }
    };

    verify();
  }, [token]);

  return (
    <AuthLayout title="Email Verification">
      <div className="text-center space-y-6 py-8">
        <AnimatePresence mode="wait">
          {status === 'verifying' && (
            <motion.div 
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 font-medium">{message}</p>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Verification Successful</h2>
              <p className="text-gray-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                {message}
              </p>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/')}
                className="w-full h-14 bg-white text-black font-bold rounded-2xl transition-all"
              >
                Continue to Login
              </motion.button>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
              <p className="text-red-400/80 text-sm leading-relaxed max-w-[280px] mx-auto">
                {message}
              </p>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/')}
                className="w-full h-14 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all"
              >
                Back to Registration
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthLayout>
  );
};
