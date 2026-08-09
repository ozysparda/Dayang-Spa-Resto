import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Staff from './pages/Staff';
import Attendance from './pages/Attendance';
import Treatments from './pages/Treatments';
import Inventory from './pages/Inventory';
import Chat from './pages/Chat';
import Announcements from './pages/Announcements';
import Profile from './pages/Profile';
import UserManagement from './pages/UserManagement';
import Outlets from './pages/Outlets';
import SystemSettings from './pages/SystemSettings';
import Layout from './components/Layout';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      
      <Route path="/" element={
        <ProtectedRoute allowedRoles={['STAFF', 'ADMIN', 'DEVELOPER']}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="bookings" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DEVELOPER']}>
            <Bookings />
          </ProtectedRoute>
        } />
        <Route path="staff" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DEVELOPER']}>
            <Staff />
          </ProtectedRoute>
        } />
        <Route path="attendance" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DEVELOPER']}>
            <Attendance />
          </ProtectedRoute>
        } />
        <Route path="treatments" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DEVELOPER']}>
            <Treatments />
          </ProtectedRoute>
        } />
        <Route path="inventory" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'DEVELOPER']}>
            <Inventory />
          </ProtectedRoute>
        } />
        <Route path="chat" element={<Chat />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="profile" element={<Profile />} />
        <Route path="users" element={
          <ProtectedRoute allowedRoles={['DEVELOPER']}>
            <UserManagement />
          </ProtectedRoute>
        } />
        <Route path="outlets" element={
          <ProtectedRoute allowedRoles={['DEVELOPER']}>
            <Outlets />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute allowedRoles={['DEVELOPER']}>
            <SystemSettings />
          </ProtectedRoute>
        } />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;