import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ContactsPage } from './pages/ContactsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const TrackAlertPage = lazy(() =>
  import('./pages/TrackAlertPage').then((m) => ({ default: m.TrackAlertPage })),
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/track/:token"
        element={
          <Suspense fallback={<div className="grid min-h-screen place-items-center bg-night font-mono text-xs tracking-widest text-mist">LOCATING…</div>}>
            <TrackAlertPage />
          </Suspense>
        }
      />
      <Route path="/admin" element={<AdminRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<AdminDashboard />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/me" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;