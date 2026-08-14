import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useProfile } from '../lib/users';

/** Protected + admin-gated route. Non-admins get a 403-style screen. */
export function AdminRoute() {
  const { user, initializing } = useAuth();
  const profile = useProfile();

  if (initializing) return <div className="min-h-screen bg-slate-950" />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile.isLoading) return <div className="min-h-screen bg-slate-950" />;
  if (!profile.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <h1 className="text-xl font-semibold text-slate-200">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-400">Your account is not an administrator.</p>
      </div>
    );
  }
  return <Outlet />;
}