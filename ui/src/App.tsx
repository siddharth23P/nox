import { useState } from 'react';
import { motion } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Register } from './components/auth/Register';
import { Login } from './components/auth/Login';
import { EmailVerification } from './components/auth/EmailVerification';
import { AuthCallback } from './components/auth/AuthCallback';
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
          
          <Route path="/dashboard" element={
            isAuthenticated ? (
              <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="z-10 text-center space-y-8"
                >
                  <h1 className="text-white text-5xl font-light tracking-tight">
                    Welcome to <span className="text-blue-500 font-semibold tracking-tighter">Nox</span>
                  </h1>
                  
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => useAuthStore.getState().logout()}
                    className="px-8 py-3 rounded-full border border-white/10 text-white/50 hover:text-white transition-all text-sm font-medium backdrop-blur-sm"
                  >
                    Sign out of Nexus
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              <Navigate to="/" replace />
            )
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
