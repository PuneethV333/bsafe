import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function ProtectedRoute() {
  const { user, initializing, syncing } = useAuth();

  if (initializing || syncing) {
    return <div className="min-h-screen bg-night" />;
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}