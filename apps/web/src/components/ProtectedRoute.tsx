import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function ProtectedRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return <div className="min-h-screen bg-slate-950" />;
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}