import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Register } from './components/auth/Register';
import { Login } from './components/auth/Login';
import { EmailVerification } from './components/auth/EmailVerification';
import { AuthCallback } from './components/auth/AuthCallback';
import { ForgotPassword } from './components/auth/ForgotPassword';
import { ResetPassword } from './components/auth/ResetPassword';
import { AccountRecovery } from './components/auth/AccountRecovery';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { ProfileSettings } from './components/settings/ProfileSettings';
import { PreferencesSettings } from './components/settings/PreferencesSettings';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();
  const [authView, setAuthView] = useState<'login' | 'register'>('register');

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={
            !isAuthenticated ? (
              authView === 'register' ? (
                <Register onSwitch={() => setAuthView('login')} />
              ) : (
                <Login onSwitch={() => setAuthView('register')} />
              )
            ) : (
              <Navigate to="/dashboard" replace />
            )
          } />
          
          <Route path="/verify-email" element={<EmailVerification />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/account-recovery" element={<AccountRecovery />} />
          
          <Route path="/dashboard" element={
            isAuthenticated ? (
              <DashboardLayout />
            ) : (
              <Navigate to="/" replace />
            )
          }>
            <Route index element={<DashboardHome />} />
            <Route path="settings/profile" element={<ProfileSettings />} />
            <Route path="settings/preferences" element={<PreferencesSettings />} />
          </Route>

          {/* Redirect /settings/profile to dashboard sub-route */}
          <Route path="/settings/profile" element={
            isAuthenticated ? <Navigate to="/dashboard/settings/profile" replace /> : <Navigate to="/" replace />
          } />
          <Route path="/settings/preferences" element={
            isAuthenticated ? <Navigate to="/dashboard/settings/preferences" replace /> : <Navigate to="/" replace />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
