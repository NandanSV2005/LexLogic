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
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to={getDashboardPath()} className="flex items-center gap-3 group">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-slate-100 tracking-tight block">
              Lex<span className="text-indigo-400">Logic</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 -mt-1 block">
              Legal Services Network
            </span>
          </div>
        </Link>

        {/* Right User Actions */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-200">{user.email}</span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
