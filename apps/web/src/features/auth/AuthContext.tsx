import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../../lib/api/client';
import type { ApiResponse, UserSummary } from '../../types/api';

type LoginInput = { identifier: string; password: string; rememberMe: boolean };

type AuthContextValue = {
  user: UserSummary | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const refreshResponse = await api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh');
    setAccessToken(refreshResponse.data.data.accessToken);
    const meResponse = await api.get<ApiResponse<UserSummary>>('/auth/me');
    setUser(meResponse.data.data);
  }, []);

  useEffect(() => {
    refreshUser()
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<ApiResponse<{ accessToken: string; user: UserSummary }>>(
      '/auth/login',
      input,
    );
    setAccessToken(response.data.data.accessToken);
    setUser(response.data.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
