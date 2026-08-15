import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../lib/auth-errors';
import { useAuth } from '../lib/useAuth';
import { SosMark } from '../components/icons';

export function LoginPage() {
  const { user, initializing, configured, signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (initializing) {
    return <div className="min-h-screen bg-night" />;
  }
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen items-stretch bg-night text-chalk">
      {/* Ambient night glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(225,45,74,0.08),transparent_70%),radial-gradient(50%_40%_at_15%_85%,rgba(56,70,111,0.12),transparent_70%)]"
      />

      {/* Brand panel */}
      <section className="relative hidden w-[46%] max-w-xl flex-col justify-between border-r border-line/60 p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-4">
          <SosMark className="h-3.5 w-40 text-signal" />
          <span className="font-mono text-[11px] tracking-[0.24em] text-faint">
            ··· SILENT DISTRESS SIGNAL ···
          </span>
        </div>

        <div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-chalk">
            Help,
            <br />
            without a&nbsp;sound.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-mist">
            One discreet tap alerts your trusted contacts and streams them your live
            location. Nothing rings, nothing flashes — the screen barely changes.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              ['TRIGGER', 'Tap or hold the dial. No sound, no confirmation.'],
              ['TRACK', 'Contacts get a private link with your moving position.'],
              ['RESOLVE', 'You end the alert; the link stops updating instantly.'],
            ].map(([label, copy]) => (
              <li key={label} className="flex gap-4">
                <span className="mt-0.5 w-16 shrink-0 font-mono text-[11px] font-semibold tracking-[0.18em] text-signal-soft">
                  {label}
                </span>
                <p className="text-sm leading-relaxed text-mist">{copy}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[11px] leading-relaxed text-faint">
          Demo build — not a working product, not connected to any emergency services.
        </p>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <span className="font-display text-3xl font-bold tracking-tight text-chalk">bSafe</span>
            </div>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-faint">
              SILENT SOS · EMERGENCY WEB APP
            </p>
          </div>

          <p className="mt-6 rounded-xl border border-line bg-panel/70 p-3 text-center font-mono text-[11px] leading-relaxed text-mist">
            Demo build — this is <span className="font-semibold text-chalk">not a working product</span> and is
            for personal/portfolio use only. It is not connected to any emergency services.
          </p>

          {!configured ? (
            <p className="mt-4 rounded-xl border border-caution/30 bg-caution/10 p-4 text-sm leading-relaxed text-caution">
              Firebase is not configured. Set <code>VITE_FIREBASE_*</code> env vars to enable
              authentication.
            </p>
          ) : (
            <div className="mt-4 space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]">
              <div>
                <h2 className="font-display text-lg font-semibold text-chalk">
                  {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="mt-0.5 text-xs text-mist">
                  {mode === 'signin'
                    ? 'Sign in to access your SOS contacts and alerts.'
                    : 'Set up your emergency contacts and stay prepared.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onGoogle}
                disabled={submitting}
                className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-line-bright bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <GoogleIcon />
                {submitting ? 'Please wait…' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider text-faint">
                <span className="h-px flex-1 bg-line" />
                or use your email
                <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="field-label">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="field-label">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input"
                  />
                </div>
                {error && (
                  <p className="rounded-xl border border-signal/30 bg-signal/10 px-3 py-2 text-xs leading-relaxed text-signal-soft">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-signal py-2.5 text-sm font-semibold text-white transition hover:bg-signal-bright disabled:opacity-50"
                >
                  {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p className="text-center text-sm text-mist">
                {mode === 'signin' ? (
                  <>
                    No account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-medium text-signal-soft hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="font-medium text-signal-soft hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          )}

          <SosMark className="mx-auto mt-8 h-2.5 w-28 text-line lg:hidden" />
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.43-3.43A12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  );
}
