import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CitizenDashboardPage } from './pages/citizen/CitizenDashboardPage';
import { CreateServiceRequestPage } from './pages/citizen/CreateServiceRequestPage';
import { MatchingResultsPage } from './pages/citizen/MatchingResultsPage';
import { RequestDetailsPage } from './pages/citizen/RequestDetailsPage';
import { ProviderDetailsPage } from './pages/citizen/ProviderDetailsPage';
import { ProviderDashboardPage } from './pages/provider/ProviderDashboardPage';
import { ProviderProfilePage } from './pages/provider/ProviderProfilePage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProvidersPage } from './pages/admin/AdminProvidersPage';
import { AdminProviderDetailsPage } from './pages/admin/AdminProviderDetailsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingState } from './components/common/LoadingState';

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingState message="Loading LexLogic application..." />
      </div>
    );
  }

  // If unauthenticated, show public landing page
  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  // If authenticated, redirect to user role dashboard
  if (user.role === UserRole.CITIZEN) {
    return <Navigate to="/citizen/dashboard" replace />;
  }
  if (user.role === UserRole.PROVIDER) {
    return <Navigate to="/provider/dashboard" replace />;
  }
  if (user.role === UserRole.ADMIN) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <LandingPage />;
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Citizen Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.CITIZEN]} />}>
            <Route path="/citizen/dashboard" element={<CitizenDashboardPage />} />
            <Route path="/citizen/request/new" element={<CreateServiceRequestPage />} />
            <Route path="/citizen/matches/:requestId" element={<MatchingResultsPage />} />
            <Route path="/citizen/requests/:requestId" element={<RequestDetailsPage />} />
            <Route path="/citizen/providers/:providerId" element={<ProviderDetailsPage />} />
          </Route>

          {/* Provider Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.PROVIDER]} />}>
            <Route path="/provider/dashboard" element={<ProviderDashboardPage />} />
            <Route path="/provider/profile" element={<ProviderProfilePage />} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/providers" element={<AdminProvidersPage />} />
            <Route path="/admin/providers/:providerId" element={<AdminProviderDetailsPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
          </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
