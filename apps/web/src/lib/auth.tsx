import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { UserDto } from '@bsafe/shared-types';
import { AuthContext, type AuthContextValue } from './auth-context';
import { apiClient } from './apiClient';
import { auth } from './firebase';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [initializing, setInitializing] = useState(auth !== null);
  const [syncing, setSyncing] = useState(false);
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((next) => {
      setUser(next);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      syncedUid.current = null;
      return;
    }
    if (syncedUid.current === user.uid) return;
    syncedUid.current = user.uid;
    let cancelled = false;
    setSyncing(true);
    apiClient
      .post<UserDto>('/auth/sync')
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured.');
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await fbSignOut(auth);
  }, []);

  const value: AuthContextValue = {
    user,
    initializing,
    syncing,
    configured: auth !== null,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}