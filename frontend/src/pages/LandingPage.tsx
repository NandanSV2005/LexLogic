import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  UserCheck,
  TrendingUp,
  FileText,
  Menu,
  X,
  Building2,
  Users,
  Eye,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Card, CardTitle, CardDescription } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user, isCitizen, isProvider, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const getDashboardPath = () => {
    if (isCitizen) return '/citizen/dashboard';
    if (isProvider) return '/provider/dashboard';
    if (isAdmin) return '/admin/dashboard';
    return '/login';
  };

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col font-sans selection:bg-[#B3A7CF] selection:text-[#141C16]">
      {/* PUBLIC NAVBAR */}
      <header className="sticky top-0 z-50 bg-[#1C261F]/90 backdrop-blur-md border-b border-[#2D3D32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
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

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#A3B5A7]">
            <a href="#how-it-works" className="hover:text-[#8EA895] transition-colors">
              How It Works
            </a>
            <a href="#why-lexlogic" className="hover:text-[#8EA895] transition-colors">
              Why LexLogic
            </a>
            <a href="#for-citizens" className="hover:text-[#8EA895] transition-colors">
              For Citizens
            </a>
            <a href="#for-providers" className="hover:text-[#8EA895] transition-colors">
              For Providers
            </a>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <Link to={getDashboardPath()}>
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#A3B5A7] hover:text-[#E6EFE8] focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1C261F] border-b border-[#2D3D32] px-4 py-4 space-y-3">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-[#A3B5A7] hover:text-[#8EA895] py-1.5"
            >
              How It Works
            </a>
            <a
              href="#why-lexlogic"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-[#A3B5A7] hover:text-[#8EA895] py-1.5"
            >
              Why LexLogic
            </a>
            <a
              href="#for-citizens"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-[#A3B5A7] hover:text-[#8EA895] py-1.5"
            >
              For Citizens
            </a>
            <a
              href="#for-providers"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-[#A3B5A7] hover:text-[#8EA895] py-1.5"
            >
              For Providers
            </a>

            <div className="pt-3 border-t border-[#2D3D32] flex flex-col gap-2">
              {isAuthenticated && user ? (
                <Link to={getDashboardPath()} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="sm" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1C261F] border border-[#2D3D32] rounded-full text-xs font-semibold text-[#E6EFE8]">
              <Sparkles className="w-4 h-4 text-[#8EA895]" />
              <span>Service-First Legal Access & Transparent Matching</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#E6EFE8] tracking-tight leading-[1.15]">
              Connecting Citizens with Verified Legal & Specialised Services
            </h1>

            <p className="text-sm sm:text-base text-[#A3B5A7] leading-relaxed max-w-2xl mx-auto">
              LexLogic helps citizens express legal service requests and transparently connects them with Advocates, Mediators, Arbitrators, Notaries, and Document Writers — with privacy-by-default document protection.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <Link to="/register">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Create Service Request
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg">
                  Provider Access Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-16 bg-[#1C261F]/60 border-y border-[#2D3D32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#E6EFE8] tracking-tight">
              How LexLogic Operates
            </h2>
            <p className="text-xs sm:text-sm text-[#A3B5A7]">
              A transparent 3-step workflow designed to protect citizen privacy and streamline service matching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 bg-[#1C261F] border border-[#2D3D32] text-[#8EA895] rounded-xl flex items-center justify-center font-bold text-sm">
                01
              </div>
              <CardTitle>Describe Your Legal Need</CardTitle>
              <CardDescription>
                Citizens post a service request specifying service category, urgency level, location, and legal aid interest.
              </CardDescription>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 bg-[#1C261F] border border-[#2D3D32] text-[#B3A7CF] rounded-xl flex items-center justify-center font-bold text-sm">
                02
              </div>
              <CardTitle>Transparent Match Scoring</CardTitle>
              <CardDescription>
                Our algorithm matches requests with eligible providers based on practice area, verification score, reliability score, and location matching.
              </CardDescription>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="w-10 h-10 bg-[#1C261F] border border-[#2D3D32] text-[#E89D9D] rounded-xl flex items-center justify-center font-bold text-sm">
                03
              </div>
              <CardTitle>Private Document Sharing</CardTitle>
              <CardDescription>
                Documents are private by default. Citizens explicitly grant View-Only or View + Download permissions to specific providers.
              </CardDescription>
            </Card>
          </div>
        </div>
      </section>

      {/* WHY LEXLOGIC & FOR PROVIDERS SECTION */}
      <section id="for-providers" className="py-16">
        <div id="why-lexlogic" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1C261F] border border-[#2D3D32] rounded-full text-xs font-semibold text-[#8EA895] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>For Legal & Specialized Providers</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#E6EFE8] tracking-tight">
              Ecosystem & Service Delivery Architecture
            </h2>
            <p className="text-xs sm:text-sm text-[#A3B5A7]">
              Built for Advocates, Mediators, Arbitrators, Notaries, and Document Writers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#8EA895]" />
                <h3 className="font-bold text-[#E6EFE8]">Advocates & Legal Counsel</h3>
              </div>
              <p className="text-xs text-[#A3B5A7] leading-relaxed">
                Connect with citizens seeking civil, criminal, corporate, and property litigation representation.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Scale className="w-5 h-5 text-[#B3A7CF]" />
                <h3 className="font-bold text-[#E6EFE8]">Mediators & Arbitrators</h3>
              </div>
              <p className="text-xs text-[#A3B5A7] leading-relaxed">
                Receive specialized requests for alternative dispute resolution, commercial arbitration, and family settlements.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-[#E89D9D]" />
                <h3 className="font-bold text-[#E6EFE8]">Notaries & Document Writers</h3>
              </div>
              <p className="text-xs text-[#A3B5A7] leading-relaxed">
                Provide affidavit notarization, document attestation, title deed drafting, and contract writing services.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* SECURE DOCUMENT SECURITY & FOR CITIZENS HIGHLIGHT */}
      <section id="for-citizens" className="py-16 bg-[#1C261F]/60 border-t border-[#2D3D32]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-8 sm:p-12 border-[#2D3D32] bg-[#233027]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1C261F] border border-[#2D3D32] rounded-full text-xs font-semibold text-[#E6EFE8]">
                  <Lock className="w-3.5 h-3.5 text-[#8EA895]" />
                  <span>For Citizens — Privacy-by-Default Architecture</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#E6EFE8] tracking-tight">
                  Citizen-Controlled Document Access
                </h3>
                <p className="text-xs sm:text-sm text-[#A3B5A7] leading-relaxed">
                  LexLogic ensures documents uploaded by citizens remain private by default. Expressing interest or viewing a request does not grant document access. Citizens explicitly grant View-Only or View + Download permissions and can revoke access anytime.
                </p>
              </div>

              <div className="shrink-0 space-y-3 w-full md:w-auto">
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-center gap-3 text-xs">
                  <Eye className="w-4 h-4 text-[#8EA895]" />
                  <span className="font-semibold text-[#E6EFE8]">View Only (Stream inline, no download)</span>
                </div>
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-center gap-3 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#B3A7CF]" />
                  <span className="font-semibold text-[#E6EFE8]">View + Download (Explicit permission)</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-[#1C261F] border-t border-[#2D3D32] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-[#A3B5A7]">
          <p>© {new Date().getFullYear()} LexLogic Legal Access Network. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
