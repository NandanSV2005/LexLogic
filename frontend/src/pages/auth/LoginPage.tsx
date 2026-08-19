import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scale, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { UserRole } from '../../types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/common/ErrorState';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password);
      login(response.access_token, response.user);

      // Redirect based on backend user role
      if (response.user.role === UserRole.CITIZEN) {
        navigate('/citizen/dashboard');
      } else if (response.user.role === UserRole.PROVIDER) {
        navigate('/provider/dashboard');
      } else if (response.user.role === UserRole.ADMIN) {
        navigate('/admin/dashboard');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141C16] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-[#1C261F] border border-[#2D3D32] rounded-2xl text-[#8EA895] mb-4 shadow-sm">
          <Scale className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#E6EFE8] tracking-tight">Sign in to LexLogic</h2>
        <p className="text-xs text-[#A3B5A7] mt-1.5">
          Service-first legal access & transparent provider matching network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#233027] border border-[#2D3D32] rounded-2xl p-8 shadow-sm">
          {errorMessage && (
            <ErrorState
              title="Authentication Failed"
              message={errorMessage}
              className="mb-6"
            />
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-[#A3B5A7]">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-bold text-[#8EA895] hover:text-[#A2BCA9]">
              Register now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
