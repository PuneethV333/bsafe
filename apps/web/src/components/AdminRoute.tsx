import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useProfile } from '../lib/users';

/** Protected + admin-gated route. Non-admins get a 403-style screen. */
export function AdminRoute() {
  const { user, initializing, syncing } = useAuth();
  const profile = useProfile();

  if (initializing || syncing) return <div className="min-h-screen bg-night" />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile.isLoading) return <div className="min-h-screen bg-night" />;
  if (!profile.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-night p-6 text-center text-chalk">
        <h1 className="font-display text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-mist">Your account is not an administrator.</p>
      </div>
    );
  }
  return <Outlet />;
}