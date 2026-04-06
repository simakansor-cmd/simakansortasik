import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import KaderisasiManagement from './pages/KaderisasiManagement';
import KaderisasiForm from './pages/KaderisasiForm';
import ParticipantManagement from './pages/ParticipantManagement';
import AllParticipants from './pages/AllParticipants';
import AccountManagement from './pages/AccountManagement';
import AttendanceScanner from './pages/AttendanceScanner';
import AttendancePage from './pages/AttendancePage';
import RegistrationPage from './pages/RegistrationPage';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, profile, loading, isAdminUtama } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // If roles are specified, check if user has one of those roles OR is admin_utama
  if (roles && profile) {
    const hasRole = roles.includes(profile.role) || isAdminUtama;
    if (!hasRole) return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const RegistrationWrapper = () => {
  const { user } = useAuth();
  if (user) {
    return <Layout><RegistrationPage /></Layout>;
  }
  return <RegistrationPage />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<RegistrationWrapper />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/kaderisasi" element={
              <ProtectedRoute roles={['admin_utama', 'admin_pac']}>
                <Layout><KaderisasiManagement /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/kaderisasi/new" element={
              <ProtectedRoute roles={['admin_pac']}>
                <Layout><KaderisasiForm /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/participants" element={
              <ProtectedRoute roles={['admin_pac', 'admin_utama']}>
                <Layout><AllParticipants /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/participants/:kegiatanId" element={
              <ProtectedRoute roles={['admin_pac', 'admin_utama']}>
                <Layout><ParticipantManagement /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/accounts" element={
              <ProtectedRoute roles={['admin_utama']}>
                <Layout><AccountManagement /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/scan/:kegiatanId" element={
              <ProtectedRoute roles={['admin_pac']}>
                <Layout><AttendanceScanner /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/absensi" element={
              <ProtectedRoute roles={['admin_pac', 'admin_utama']}>
                <Layout><AttendancePage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
