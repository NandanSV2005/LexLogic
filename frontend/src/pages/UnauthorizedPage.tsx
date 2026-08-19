import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Navbar } from '../components/layout/Navbar';

export const UnauthorizedPage: React.FC = () => {
  const { user, isCitizen, isProvider, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleReturnToDashboard = () => {
    if (isCitizen) navigate('/citizen/dashboard');
    else if (isProvider) navigate('/provider/dashboard');
    else if (isAdmin) navigate('/admin/dashboard');
    else navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#141C16] flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-[#3D2020]/40 border border-[#5E3232] rounded-2xl text-[#E89D9D] mb-6 animate-pulse">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#E6EFE8] tracking-tight">403 - Access Denied</h1>
        <p className="text-sm text-[#A3B5A7] max-w-md mt-2 mb-8 leading-relaxed">
          You do not have authorization to access this resource. Your account role ({user?.role || 'Guest'}) does not match the required security permissions for this endpoint.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            onClick={handleReturnToDashboard}
            leftIcon={<Home className="w-4 h-4" />}
          >
            Return to My Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
};
