import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { AuthLayout } from './AuthLayout';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const token = searchParams.get('token');
    const user_id = searchParams.get('user_id');
    const org_id = searchParams.get('org_id');
    const email = searchParams.get('email') || '';
    const full_name = searchParams.get('full_name') || 'Social User';

    if (token && user_id && org_id) {
      setAuth(
        { id: user_id, email, fullName: full_name }, 
        token, 
        org_id
      );
      navigate('/dashboard');
    } else {
      console.error('Missing OAuth parameters');
      navigate('/');
    }
  }, [searchParams, setAuth, navigate]);

  return (
    <AuthLayout title="Completing Login">
      <div className="text-center py-20">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
        <p className="text-gray-400 font-medium">Synchronizing your Nexus identity...</p>
      </div>
    </AuthLayout>
  );
};
