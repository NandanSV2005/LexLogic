import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Navbar } from '../components/layout/Navbar';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#141C16] flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-2xl text-[#8EA895] mb-6">
          <HelpCircle className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#E6EFE8] tracking-tight">404 - Page Not Found</h1>
        <p className="text-sm text-[#A3B5A7] max-w-md mt-2 mb-8 leading-relaxed">
          The requested page route does not exist or has been relocated.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/')}
          leftIcon={<Home className="w-4 h-4" />}
        >
          Return Home
        </Button>
      </main>
    </div>
  );
};
