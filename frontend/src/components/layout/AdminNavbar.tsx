import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Scale, LogOut, LayoutDashboard, ShieldCheck, FileText } from 'lucide-react';
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
    <header className="bg-[#1C261F]/90 border-b border-[#2D3D32] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand + Badge */}
          <div className="flex items-center gap-8">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="p-2 bg-[#8EA895]/15 border border-[#8EA895]/30 rounded-xl group-hover:bg-[#8EA895]/25 transition-colors">
                <Scale className="w-5 h-5 text-[#8EA895]" />
              </div>
              <div>
                <span className="text-lg font-bold text-[#E6EFE8] tracking-tight block">
                  Lex<span className="text-[#8EA895]">Logic</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-[#A3B5A7] -mt-1 block">
                  Admin Control Panel
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/admin/dashboard"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/dashboard')
                    ? 'bg-[#233027] text-[#E6EFE8] border border-[#2D3D32]'
                    : 'text-[#A3B5A7] hover:text-[#E6EFE8] hover:bg-[#233027]/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-[#8EA895]" /> Dashboard
              </Link>

              <Link
                to="/admin/providers"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/providers')
                    ? 'bg-[#233027] text-[#E6EFE8] border border-[#2D3D32]'
                    : 'text-[#A3B5A7] hover:text-[#E6EFE8] hover:bg-[#233027]/60'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#8EA895]" /> Providers & Verification
              </Link>

              <Link
                to="/admin/audit"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/audit')
                    ? 'bg-[#233027] text-[#E6EFE8] border border-[#2D3D32]'
                    : 'text-[#A3B5A7] hover:text-[#E6EFE8] hover:bg-[#233027]/60'
                }`}
              >
                <FileText className="w-4 h-4 text-[#8EA895]" /> Security Audit Logs
              </Link>
            </nav>
          </div>

          {/* Right User & Logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#233027] border border-[#2D3D32] rounded-xl">
                <span className="text-xs font-semibold text-[#E6EFE8]">{user.email}</span>
                <Badge variant="purple">ADMIN</Badge>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#A3B5A7] hover:text-[#E89D9D] hover:bg-[#3D2020]/50 rounded-xl border border-transparent hover:border-[#5E3232] transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
