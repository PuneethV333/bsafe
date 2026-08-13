import { createContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextValue {
  user: FirebaseUser | null;
  initializing: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);