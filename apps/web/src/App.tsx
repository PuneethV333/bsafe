import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ContactsPage } from './pages/ContactsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { TrackAlertPage } from './pages/TrackAlertPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/track/:token" element={<TrackAlertPage />} />
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