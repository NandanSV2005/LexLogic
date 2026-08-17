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
    <header className="sticky top-0 z-40 bg-[#DDE8DC]/90 backdrop-blur-md border-b border-[#C8D7C7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to={getDashboardPath()} className="flex items-center gap-3 group">
          <div className="p-2 bg-[#7C9A82]/15 border border-[#7C9A82]/30 rounded-xl text-[#7C9A82] group-hover:bg-[#7C9A82]/25 transition-colors">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-[#29352D] tracking-tight block">
              Lex<span className="text-[#7C9A82]">Logic</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#617066] -mt-1 block">
              Legal Access Network
            </span>
          </div>
        </Link>

        {/* Right User Actions */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F0F4EC] border border-[#C8D7C7] rounded-xl">
              <UserIcon className="w-3.5 h-3.5 text-[#617066]" />
              <span className="text-xs font-semibold text-[#29352D]">{user.email}</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#617066] hover:text-[#5C1D1D] hover:bg-[#F4D6D6]/50 rounded-xl border border-transparent hover:border-[#E8B4B4] transition-all"
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
              className="text-xs font-semibold text-[#29352D] hover:text-[#7C9A82] px-3.5 py-2 rounded-xl hover:bg-[#F0F4EC] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-semibold bg-[#7C9A82] hover:bg-[#6B8870] text-white px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
