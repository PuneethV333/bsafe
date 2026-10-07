import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { FullPageLoader } from './FullPageLoader';

export function ProtectedRoute() {
  const { user, initializing, syncing } = useAuth();

  if (initializing) return <FullPageLoader label="RESTORING SESSION…" />;
  if (syncing) return <FullPageLoader label="SYNCING ACCOUNT…" />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}