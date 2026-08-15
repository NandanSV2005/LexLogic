import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, AuthResponse } from '../types';
import { authApi } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  isCitizen: boolean;
  isProvider: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lexlogic_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('lexlogic_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('lexlogic_token', newToken);
    localStorage.setItem('lexlogic_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lexlogic_token');
    localStorage.removeItem('lexlogic_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const currentToken = localStorage.getItem('lexlogic_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return null;
    }
    try {
      const fetchedUser = await authApi.getMe();
      setUser(fetchedUser);
      localStorage.setItem('lexlogic_user', JSON.stringify(fetchedUser));
      return fetchedUser;
    } catch (err) {
      console.error('Failed to validate auth token', err);
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    logout,
    refreshUser,
    isCitizen: user?.role === UserRole.CITIZEN,
    isProvider: user?.role === UserRole.PROVIDER,
    isAdmin: user?.role === UserRole.ADMIN,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
