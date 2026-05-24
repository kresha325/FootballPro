import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, profileAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await authAPI.me();
        let userData = { ...res.data, token };
        // Fetch profile data for profilePhoto and merge
        try {
          const profileRes = await profileAPI.getProfile(userData.id);
          userData = { ...userData, ...profileRes.data };
        } catch (profileErr) {
          // If profile fetch fails, continue with base user
        }
        setUser(userData);
      } catch (err) {
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await authAPI.me();
      let userData = { ...res.data, token };
      try {
        const profileRes = await profileAPI.getProfile(userData.id);
        userData = { ...userData, ...profileRes.data };
      } catch (_profileErr) {
        // ignore
      }
      setUser(userData);
    } catch (_err) {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const login = async (credentials) => {
    try {
      console.log('FRONTEND: Attempting login for:', credentials.email);
      const response = await authAPI.login(credentials);
      console.log('FRONTEND: Login response:', response.data);
      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      // Fetch profile data for profilePhoto and merge
      let mergedUser = { ...userData, token };
      try {
        const profileRes = await profileAPI.getProfile(userData.id);
        mergedUser = { ...mergedUser, ...profileRes.data };
      } catch (profileErr) {
        // If profile fetch fails, continue with base user
      }
      setUser(mergedUser);
      return { success: true };
    } catch (error) {
      console.error('FRONTEND: Login error:', error);
      console.error('FRONTEND: Error response:', error.response?.data);
      console.error('FRONTEND: Error message:', error.message);
      console.error('FRONTEND: Network error?', error.code === 'ERR_NETWORK');
      
      let errorMsg = 'Hyrja dështoi';
      if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Nuk mund të lidhet me serverin. Kontrollo lidhjen.';
      } else if (error.response?.data?.msg) {
        errorMsg = error.response.data.msg;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      return { success: false, error: errorMsg };
    }
  };

  const register = async (userData) => {
    try {
      console.log('FRONTEND: Sending registration data:', userData);
      const response = await authAPI.register(userData);
      console.log('FRONTEND: Registration response:', response.data);
      const { token, user: newUser, requiresParentVerification } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('fp_pending_onboarding', '1');
      if (requiresParentVerification) {
        localStorage.setItem('fp_requires_parent', '1');
      } else {
        localStorage.removeItem('fp_requires_parent');
      }
      setUser({ ...newUser, token });
      return { success: true, requiresParentVerification };
    } catch (error) {
      console.error('FRONTEND: Registration error:', error);
      console.error('FRONTEND: Error response:', error.response?.data);
      console.error('FRONTEND: Error message:', error.message);
      console.error('FRONTEND: Network error?', error.code === 'ERR_NETWORK');
      
      let errorMsg = 'Regjistrimi dështoi';
      const serverMsg = error.response?.data?.msg || error.response?.data?.error || '';
      if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Nuk mund të lidhet me serverin. Kontrollo lidhjen.';
      } else if (/already exists/i.test(serverMsg)) {
        errorMsg = 'Ky email është tashmë i regjistruar. Hyr në llogari ose përdor një email tjetër.';
      } else if (/invalid date of birth/i.test(serverMsg)) {
        errorMsg = 'Datëlindja jo valid. Përdor formatin VVVV-MM-DD.';
      } else if (/invalid email/i.test(serverMsg)) {
        errorMsg = 'Email jo valid.';
      } else if (/password must be at least/i.test(serverMsg)) {
        errorMsg = 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.';
      } else if (/invalid account type/i.test(serverMsg)) {
        errorMsg = 'Lloji i llogarisë nuk është valid.';
      } else if (serverMsg) {
        errorMsg = serverMsg;
      }

      return {
        success: false,
        error: errorMsg,
        emailAlreadyExists: /already exists/i.test(serverMsg),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    refreshUser,
    loading,
    darkMode,
    toggleDarkMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};