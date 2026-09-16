'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithCustomToken, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getClientAuth, hasFirebaseConfig } from '@/lib/firebase';
import type { AdminProfile, Permission } from '@/lib/types';

const publicSiteUrl = 'https://parkourreborn.com';

export type SetupStatus = { firebaseClient: boolean; firebaseAdmin: boolean; discord: boolean; r2: boolean; map: boolean; mapError: string };

type AuthValue = {
  user: User | null;
  admin: AdminProfile | null;
  setup: SetupStatus | null;
  loading: boolean;
  busy: boolean;
  error: string;
  can: (permission: Permission) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  api: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const redirecting = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(hasFirebaseConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(hasFirebaseConfig ? '' : 'Firebase client setup is incomplete.');

  useEffect(() => {
    fetch('/api/setup').then((response) => response.json()).then(setSetup).catch(() => undefined);
  }, []);

  const loadAdmin = useCallback(async (nextUser: User) => {
    const token = await nextUser.getIdToken();
    const response = await fetch('/api/admin/me', { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json() as { admin?: AdminProfile; error?: string };
    if (response.status === 401 || response.status === 403) {
      redirecting.current = true;
      await signOut(getClientAuth()).catch(() => undefined);
      setUser(null);
      setAdmin(null);
      window.location.replace(publicSiteUrl);
      return false;
    }
    if (!response.ok || !data.admin) throw new Error(data.error || 'Admin access denied');
    setAdmin(data.admin);
    return true;
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      return;
    }

    const auth = getClientAuth();
    let stop: () => void = () => undefined;
    let active = true;

    const boot = async () => {
      const callbackStatus = new URLSearchParams(window.location.search).get('auth');
      const callbackError = callbackStatus === 'expired'
        ? 'Discord sign-in expired. Please try again.'
        : callbackStatus === 'error'
          ? 'Discord sign-in could not be completed.'
          : '';

      try {
        await setPersistence(auth, browserLocalPersistence);
        const response = await fetch('/api/auth/discord/session', { method: 'POST' });
        if (response.ok) {
          const data = await response.json() as { token: string | null };
          if (data.token) await signInWithCustomToken(auth, data.token);
        }
      } catch {
        setError('Could not finish Discord sign-in.');
      }

      if (!active) return;
      stop = onAuthStateChanged(auth, async (nextUser) => {
        if (redirecting.current) return;
        setUser(nextUser);
        setAdmin(null);
        setError(nextUser ? '' : callbackError);
        let finishLoading = true;
        try {
          if (nextUser) finishLoading = await loadAdmin(nextUser);
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : 'Admin access denied');
        } finally {
          if (finishLoading) setLoading(false);
        }
      });
    };

    void boot();
    return () => { active = false; stop(); };
  }, [loadAdmin]);

  const api = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const current = getClientAuth().currentUser;
    if (!current) throw new Error('Sign in is required');
    const token = await current.getIdToken();
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(input, { ...init, headers });
  }, []);

  const login = async () => {
    if (!hasFirebaseConfig) return setError('Firebase client setup is incomplete.');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/discord/start', { method: 'POST' });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start Discord sign-in');
      window.location.assign(data.url);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not start Discord sign-in');
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!hasFirebaseConfig) return;
    setBusy(true);
    redirecting.current = true;
    await signOut(getClientAuth()).catch(() => undefined);
    setUser(null);
    setAdmin(null);
    window.location.replace(publicSiteUrl);
  };

  const value = useMemo<AuthValue>(() => ({
    user,
    admin,
    setup,
    loading,
    busy,
    error,
    can: (permission) => Boolean(admin?.permissions.includes(permission)),
    login,
    logout,
    api,
  }), [admin, api, busy, error, loading, setup, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
