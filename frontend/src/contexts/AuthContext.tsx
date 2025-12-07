// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthStatusResponse, LoginResponse } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');
const TOKEN_KEY = 'spacebio_auth_token';
const TOKEN_EXPIRY_KEY = 'spacebio_auth_expiry';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authRequired: boolean;
  token: string | null;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (stored && expiry) {
      // Check if token is expired
      if (Date.now() < parseInt(expiry, 10)) {
        return stored;
      }
      // Token expired, clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/status`);
        if (res.ok) {
          const data: AuthStatusResponse = await res.json();
          setAuthRequired(data.auth_required);
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // Verify token on mount if we have one
  useEffect(() => {
    const verifyToken = async () => {
      if (!token || !authRequired) return;

      try {
        const res = await fetch(`${API_BASE}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // Token is invalid, clear it
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
        }
      } catch (err) {
        console.error('Failed to verify token:', err);
      }
    };
    verifyToken();
  }, [token, authRequired]);

  const login = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Login failed' }));
        return { success: false, error: data.detail || 'Invalid password' };
      }

      const data: LoginResponse = await res.json();
      const expiry = Date.now() + data.expires_in * 1000;

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
      setToken(data.access_token);

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Connection failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setToken(null);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, [token]);

  const isAuthenticated = !authRequired || !!token;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authRequired,
        token,
        login,
        logout,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
