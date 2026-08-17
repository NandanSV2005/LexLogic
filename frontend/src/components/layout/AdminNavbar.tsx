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
    <header className="bg-[#DDE8DC]/90 border-b border-[#C8D7C7] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Brand + Badge */}
          <div className="flex items-center gap-8">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="p-2 bg-[#7C9A82]/15 border border-[#7C9A82]/30 rounded-xl group-hover:bg-[#7C9A82]/25 transition-colors">
                <Scale className="w-5 h-5 text-[#7C9A82]" />
              </div>
              <div>
                <span className="text-lg font-bold text-[#29352D] tracking-tight block">
                  Lex<span className="text-[#7C9A82]">Logic</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-[#617066] -mt-1 block">
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
                    ? 'bg-[#F0F4EC] text-[#29352D] border border-[#C8D7C7]'
                    : 'text-[#617066] hover:text-[#29352D] hover:bg-[#F0F4EC]/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-[#7C9A82]" /> Dashboard
              </Link>

              <Link
                to="/admin/providers"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/providers')
                    ? 'bg-[#F0F4EC] text-[#29352D] border border-[#C8D7C7]'
                    : 'text-[#617066] hover:text-[#29352D] hover:bg-[#F0F4EC]/60'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#7C9A82]" /> Providers & Verification
              </Link>

              <Link
                to="/admin/audit"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive('/admin/audit')
                    ? 'bg-[#F0F4EC] text-[#29352D] border border-[#C8D7C7]'
                    : 'text-[#617066] hover:text-[#29352D] hover:bg-[#F0F4EC]/60'
                }`}
              >
                <FileText className="w-4 h-4 text-[#7C9A82]" /> Security Audit Logs
              </Link>
            </nav>
          </div>

          {/* Right User & Logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F0F4EC] border border-[#C8D7C7] rounded-xl">
                <span className="text-xs font-semibold text-[#29352D]">{user.email}</span>
                <Badge variant="purple">ADMIN</Badge>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#617066] hover:text-[#5C1D1D] hover:bg-[#F4D6D6]/50 rounded-xl border border-transparent hover:border-[#E8B4B4] transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
