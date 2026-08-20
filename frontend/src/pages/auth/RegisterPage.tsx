import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scale, Lock, Mail, ArrowRight, UserCheck, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { UserRole } from '../../types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/common/ErrorState';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CITIZEN);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register(email, password, role);
      const response = await authApi.login(email, password);
      login(response.access_token, response.user);

      // Redirect based on backend user role
      if (response.user.role === UserRole.CITIZEN) {
        navigate('/citizen/dashboard');
      } else if (response.user.role === UserRole.PROVIDER) {
        navigate('/provider/onboarding');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
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
        <h2 className="text-2xl font-extrabold text-[#E6EFE8] tracking-tight">Create LexLogic Account</h2>
        <p className="text-xs text-[#A3B5A7] mt-1.5">
          Join the transparent legal access & provider matching network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#233027] border border-[#2D3D32] rounded-2xl p-8 shadow-sm">
          {errorMessage && (
            <ErrorState
              title="Registration Error"
              message={errorMessage}
              className="mb-6"
            />
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Role Selector */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-[#A3B5A7] tracking-wide uppercase">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole(UserRole.CITIZEN)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                    role === UserRole.CITIZEN
                      ? 'bg-[#1C261F] border-[#8EA895] text-[#E6EFE8]'
                      : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#8EA895]'
                  }`}
                >
                  <UserCheck className="w-5 h-5 text-[#8EA895]" />
                  <span>Citizen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole(UserRole.PROVIDER)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                    role === UserRole.PROVIDER
                      ? 'bg-[#2B253D] border-[#B3A7CF] text-[#E6EFE8]'
                      : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#B3A7CF]'
                  }`}
                >
                  <Briefcase className="w-5 h-5 text-[#B3A7CF]" />
                  <span>Legal Provider</span>
                </button>
              </div>
            </div>

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
              placeholder="At least 8 chars with digit & symbol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-[#A3B5A7]">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-[#8EA895] hover:text-[#A2BCA9]">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
