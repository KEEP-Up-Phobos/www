import React, { createContext, useContext } from 'react';
import { User } from '../api/types';
import { useAuth as useAuthHook } from '../shared/hooks/useAuth';

type AuthContextShape = ReturnType<typeof useAuthHook>;

const AuthContext = createContext<AuthContextShape | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthHook();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextShape => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthProvider;
