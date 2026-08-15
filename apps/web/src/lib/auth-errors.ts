import type { AuthError } from 'firebase/auth';

const FRIENDLY_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':
    'This email is already registered. Try signing in instead, or use a different email.',
  'auth/invalid-email': "That doesn't look like a valid email address. Please check it and try again.",
  'auth/weak-password': 'Your password is too weak. Use at least 6 characters.',
  'auth/user-not-found':
    'No account found with this email. Check the email or create a new account.',
  'auth/wrong-password': 'Incorrect password. Double-check it and try again.',
  'auth/invalid-credential': 'Incorrect email or password. Please try again.',
  'auth/invalid-login-credentials': 'Incorrect email or password. Please try again.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a minute or two before trying again.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/operation-not-allowed':
    'Email/password sign-in is not enabled on this account. Contact support.',
  'auth/popup-blocked':
    'The sign-in popup was blocked by your browser. Allow popups for this site and try again.',
  'auth/popup-closed-by-user':
    'The sign-in popup was closed before signing in. Try again when you are ready.',
  'auth/cancelled-popup-request':
    'The sign-in popup was cancelled. Try again if you still want to sign in.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email but uses a different sign-in method. Sign in with that method instead.',
  'auth/unauthorized-domain':
    'Sign-in is not enabled for this website. Contact the site owner.',
  'auth/network-request-failed':
    'No internet connection. Check your connection and try again.',
  'auth/internal-error': 'Something went wrong on our side. Please try again.',
  'auth/timeout': 'The sign-in request timed out. Please try again.',
};

export function getAuthErrorMessage(err: unknown): string {
  const code = (err as AuthError | null)?.code;
  if (!code) return 'Something went wrong. Please try again.';
  return (
    FRIENDLY_MESSAGES[code] ??
    'Something went wrong while signing you in. Please try again.'
  );
}