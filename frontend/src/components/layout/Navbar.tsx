import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Scale } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, isCitizen, isProvider, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (isCitizen) return '/citizen/dashboard';
    if (isProvider) return '/provider/dashboard';
    if (isAdmin) return '/admin/dashboard';
    return '/login';
  };

  return (
    <header className="sticky top-0 z-40 bg-[#1C261F]/90 backdrop-blur-md border-b border-[#2D3D32]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to={getDashboardPath()} className="flex items-center gap-3 group">
          <div className="p-2 bg-[#8EA895]/15 border border-[#8EA895]/30 rounded-xl text-[#8EA895] group-hover:bg-[#8EA895]/25 transition-colors">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-[#E6EFE8] tracking-tight block">
              Lex<span className="text-[#8EA895]">Logic</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#A3B5A7] -mt-1 block">
              Legal Access Network
            </span>
          </div>
        </Link>

        {/* Right User Actions */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#233027] border border-[#2D3D32] rounded-xl">
              <UserIcon className="w-3.5 h-3.5 text-[#A3B5A7]" />
              <span className="text-xs font-semibold text-[#E6EFE8]">{user.email}</span>
              <Badge
                variant={
                  isAdmin ? 'purple' : isProvider ? 'indigo' : 'success'
                }
                size="sm"
              >
                {user.role}
              </Badge>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#A3B5A7] hover:text-[#E89D9D] hover:bg-[#3D2020]/50 rounded-xl border border-transparent hover:border-[#5E3232] transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Link
              to="/login"
              className="text-xs font-semibold text-[#E6EFE8] hover:text-[#8EA895] px-3.5 py-2 rounded-xl hover:bg-[#233027] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-semibold bg-[#8EA895] hover:bg-[#A2BCA9] text-[#141C16] px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
