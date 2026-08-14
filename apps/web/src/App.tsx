import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
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
          <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Loading…</div>}>
            <TrackAlertPage />
          </Suspense>
        }
      />
      <Route path="/admin" element={<AdminRoute />}>
        <Route index element={<AdminDashboard />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/me" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;