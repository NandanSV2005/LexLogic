import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Scale, ShieldAlert, Users, FileText, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

export const AdminNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand + Badge */}
          <div className="flex items-center gap-8">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                <Scale className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-100 tracking-tight block">
                  Lex<span className="text-indigo-400">Logic</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 -mt-1 block">
                  Admin Platform
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/admin/dashboard"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/dashboard')
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>

              <Link
                to="/admin/providers"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/providers')
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Providers & Verification
              </Link>

              <Link
                to="/admin/audit"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/audit')
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-4 h-4" /> Security Audit Logs
              </Link>
            </nav>
          </div>

          {/* Right User & Logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-xs font-medium text-slate-300">{user.email}</span>
                <Badge variant="indigo">ADMIN</Badge>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
