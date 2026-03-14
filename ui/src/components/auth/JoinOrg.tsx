import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useInvitationStore } from '../../stores/invitationStore';
import type { InviteLinkInfo } from '../../stores/invitationStore';

export const JoinOrg: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { joinViaLink, acceptInvitation, isLoading, error } = useInvitationStore();

  const [linkInfo, setLinkInfo] = useState<InviteLinkInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [joined, setJoined] = useState(false);
  const { getInviteLinkInfo } = useInvitationStore();

  // If this is a link invite (not a token), fetch info
  useEffect(() => {
    const fetchInfo = async () => {
      if (code && code !== 'accept') {
        const info = await getInviteLinkInfo(code);
        setLinkInfo(info);
      }
      setLoadingInfo(false);
    };
    fetchInfo();
  }, [code, getInviteLinkInfo]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      // Store the invite URL and redirect to login
      localStorage.setItem('nox_pending_invite', window.location.pathname + window.location.search);
      navigate('/');
      return;
    }

    let result;
    if (token) {
      // Email invite: accept via token
      result = await acceptInvitation(token);
    } else if (code) {
      // Link invite: join via code
      result = await joinViaLink(code);
    }

    if (result) {
      setJoined(true);
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
  };

  const isTokenInvite = code === 'accept' && token;
  const title = isTokenInvite ? 'You\'ve Been Invited' : linkInfo?.org_name ? `Join ${linkInfo.org_name}` : 'Join Organization';

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-[#0b0b0b]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6"
      >
        {loadingInfo ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading invite details...</p>
          </div>
        ) : joined ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Welcome!</h2>
            <p className="text-gray-400 text-sm">You've successfully joined the organization. Redirecting to dashboard...</p>
          </motion.div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {linkInfo && (
                <p className="text-gray-400 text-sm">
                  You'll join as a <span className="text-blue-400 font-semibold">{linkInfo.role}</span>
                </p>
              )}
              {isTokenInvite && (
                <p className="text-gray-400 text-sm">
                  Click below to accept your invitation
                </p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-xs text-center font-medium bg-red-400/5 py-2 rounded-lg border border-red-400/10"
              >
                {error}
              </motion.div>
            )}

            {!linkInfo && !isTokenInvite ? (
              <div className="text-center space-y-3">
                <p className="text-gray-500 text-sm">This invite link is invalid or has expired.</p>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-white/5 text-white font-semibold text-sm rounded-xl hover:bg-white/10 transition-colors"
                >
                  Go Home
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.01, backgroundColor: '#157ad3' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleJoin}
                  disabled={isLoading}
                  className="w-full h-[52px] bg-[#1d8cf8] text-white font-bold text-[15px] rounded-2xl shadow-[0_8px_20px_-4px_rgba(29,140,248,0.3)] flex items-center justify-center transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : !isAuthenticated ? (
                    'Sign in to Join'
                  ) : (
                    'Accept & Join'
                  )}
                </motion.button>

                {!isAuthenticated && (
                  <p className="text-gray-500 text-xs text-center">
                    You need to be signed in to join an organization
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};
