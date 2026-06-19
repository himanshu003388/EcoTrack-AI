import React, { createContext, useContext, useState, useEffect, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CardSkeleton } from './components/Skeleton';
import { ToastProvider } from './components/Toast';
import { useRouteAnnounce } from './components/Hooks';

interface CsrfManager {
  token: string | null;
  refreshPromise: Promise<void> | null;
}

const csrfState: CsrfManager = { token: null, refreshPromise: null };

function getCsrfToken(): string | null {
  return csrfState.token;
}

async function refreshCsrfToken(): Promise<void> {
  if (csrfState.refreshPromise) return csrfState.refreshPromise;
  csrfState.refreshPromise = (async (): Promise<void> => {
    try {
      const tokenRes = await fetch('/api/csrf-token', { credentials: 'include' });
      if (tokenRes.ok) {
        const data = (await tokenRes.json()) as { csrfToken: string };
        csrfState.token = data.csrfToken;
      }
    } catch {
      csrfState.token = null;
    } finally {
      csrfState.refreshPromise = null;
    }
  })();
  return csrfState.refreshPromise;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (['GET', 'HEAD', 'OPTIONS'].includes(method) || url.includes('/api/csrf-token')) {
    return fetch(input, { ...init, credentials: 'include' });
  }

  if (csrfState.token === null) {
    await refreshCsrfToken();
  }

  const headers = new Headers(init?.headers);
  if (csrfState.token !== null) {
    headers.set('X-CSRF-Token', csrfState.token);
  }

  const response = await fetch(input, { ...init, headers, credentials: 'include' });

  if (response.status === 403 && csrfState.token !== null) {
    csrfState.token = null;
    await refreshCsrfToken();
    const tokenAfterRefresh = getCsrfToken();
    if (tokenAfterRefresh !== null) {
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('X-CSRF-Token', tokenAfterRefresh);
      return fetch(input, { ...init, headers: retryHeaders, credentials: 'include' });
    }
  }

  return response;
}

const Dashboard = lazy(async () => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Tracker = lazy(async () => import('./pages/Tracker').then((m) => ({ default: m.Tracker })));
const Simulator = lazy(async () => import('./pages/Simulator').then((m) => ({ default: m.Simulator })));
const ForecastPage = lazy(async () => import('./pages/ForecastPage').then((m) => ({ default: m.ForecastPage })));
const Coach = lazy(async () => import('./pages/Coach').then((m) => ({ default: m.Coach })));
const Challenges = lazy(async () => import('./pages/Challenges').then((m) => ({ default: m.Challenges })));
const ReportsPage = lazy(async () => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export interface AppUser {
  id: number;
  email: string;
  username: string;
  points: number;
  level: string;
  streak: number;
}

interface AuthContextType {
  token: string | null;
  user: AppUser | null;
  login: (token: string, user: AppUser) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ecotrack_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('ecotrack_theme', theme);
  }, [theme]);

  const toggleTheme = (): void => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserProfile = async (): Promise<void> => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as AppUser;
        setUser(data);
      }
    } catch {
      // Silently handle - user will see auth error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUserProfile();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = (_token: string, _user: AppUser): void => {};
  const logout = (): void => {};
  const refreshUser = async (): Promise<void> => {
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider value={{ token: null, user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-forest-950"
        role="status"
        aria-label="Loading EcoTrack AI application"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-forest-500 border-t-transparent"
            aria-hidden="true"
          ></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium" aria-live="polite">
            Loading EcoTrack AI...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RouteAnnouncer: React.FC = () => {
  useRouteAnnounce();
  return null;
};

const PageFallback: React.FC = () => (
  <div className="space-y-6 animate-fade-in" role="status" aria-label="Loading page">
    <div className="h-8 w-48 bg-slate-200 dark:bg-forest-800 animate-pulse rounded" aria-hidden="true"></div>
    <CardSkeleton />
    <span className="sr-only">Loading page...</span>
  </div>
);

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-in">
      {children}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <ToastProvider>
                <Routes>
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <RouteAnnouncer />
                          <Suspense fallback={<PageFallback />}>
                            <Routes>
                              <Route
                                path="/"
                                element={
                                  <PageTransition>
                                    <Dashboard />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/tracker"
                                element={
                                  <PageTransition>
                                    <Tracker />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/simulator"
                                element={
                                  <PageTransition>
                                    <Simulator />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/forecast"
                                element={
                                  <PageTransition>
                                    <ForecastPage />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/coach"
                                element={
                                  <PageTransition>
                                    <Coach />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/challenges"
                                element={
                                  <PageTransition>
                                    <Challenges />
                                  </PageTransition>
                                }
                              />
                              <Route
                                path="/reports"
                                element={
                                  <PageTransition>
                                    <ReportsPage />
                                  </PageTransition>
                                }
                              />
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </ToastProvider>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
