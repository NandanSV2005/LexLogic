import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
import { ProviderOnboardingPage } from './pages/provider/ProviderOnboardingPage';
import { ProviderCaseWorkspacePage } from './pages/provider/ProviderCaseWorkspacePage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProvidersPage } from './pages/admin/AdminProvidersPage';
import { AdminProviderDetailsPage } from './pages/admin/AdminProviderDetailsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';

const RouteTitleUpdater: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/citizen')) {
      if (path.includes('/request/new')) {
        document.title = 'LexLogic | Service Request';
      } else if (path.includes('/matches')) {
        document.title = 'LexLogic | Provider Matching';
      } else {
        document.title = 'LexLogic | Citizen Portal';
      }
    } else if (path.startsWith('/provider')) {
      document.title = 'LexLogic | Provider Portal';
    } else if (path.startsWith('/admin')) {
      document.title = 'LexLogic | Admin Portal';
    } else if (path === '/login') {
      document.title = 'LexLogic | Sign In';
    } else if (path === '/register') {
      document.title = 'LexLogic | Register';
    } else {
      document.title = 'LexLogic — Service-First Legal Access Platform';
    }
  }, [location]);

  return null;
};

export const App: React.FC = () => {
  return (
    <Router>
      <RouteTitleUpdater />
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
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
            <Route path="/provider/onboarding" element={<ProviderOnboardingPage />} />
            <Route path="/provider/dashboard" element={<ProviderDashboardPage />} />
            <Route path="/provider/profile" element={<ProviderProfilePage />} />
            <Route path="/provider/requests/:requestId" element={<ProviderCaseWorkspacePage />} />
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
