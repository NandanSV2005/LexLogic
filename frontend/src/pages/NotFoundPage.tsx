import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Navbar } from '../components/layout/Navbar';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-400 mb-6">
          <HelpCircle className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">404 - Page Not Found</h1>
        <p className="text-sm text-slate-400 max-w-md mt-2 mb-8 leading-relaxed">
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
