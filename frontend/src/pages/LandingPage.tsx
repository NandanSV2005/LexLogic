import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  FileCheck,
  Lock,
  UserCheck,
  TrendingUp,
  FileText,
  UserPlus,
  LogIn,
  Menu,
  X,
  Building2,
  Users,
  Award,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* PUBLIC NAVBAR */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
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

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">
              How It Works
            </a>
            <a href="#why-lexlogic" className="hover:text-indigo-400 transition-colors">
              Why LexLogic
            </a>
            <a href="#for-citizens" className="hover:text-indigo-400 transition-colors">
              For Citizens
            </a>
            <a href="#for-providers" className="hover:text-indigo-400 transition-colors">
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
            className="md:hidden p-2 text-slate-400 hover:text-slate-200 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-3">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-slate-300 hover:text-indigo-400 py-1.5"
            >
              How It Works
            </a>
            <a
              href="#why-lexlogic"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-slate-300 hover:text-indigo-400 py-1.5"
            >
              Why LexLogic
            </a>
            <a
              href="#for-citizens"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-slate-300 hover:text-indigo-400 py-1.5"
            >
              For Citizens
            </a>
            <a
              href="#for-providers"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-semibold text-slate-300 hover:text-indigo-400 py-1.5"
            >
              For Providers
            </a>

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
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

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-20 lg:py-28 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Hero Left Column */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Service-First Matching Engine</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                  Not sure what kind of legal help you need?
                </h1>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Describe your legal issue in plain language. LexLogic helps you find relevant, verified legal service providers without needing to know whether you require an Advocate, Mediator, Arbitrator, Notary, or Document Writer.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link to="/register">
                    <Button
                      variant="primary"
                      size="lg"
                      className="px-8 py-3 text-sm font-semibold shadow-lg shadow-indigo-600/30"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Get Started
                    </Button>
                  </Link>

                  <Link to="/login">
                    <Button
                      variant="outline"
                      size="lg"
                      className="px-6 py-3 text-sm font-semibold"
                      leftIcon={<LogIn className="w-4 h-4" />}
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>

                {/* Anti-promotional Bar Council note */}
                <div className="pt-4 flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Provider matching adheres strictly to Bar Council guidelines. Factual information only.
                  </span>
                </div>
              </div>

              {/* Hero Right Column: LexLogic Workflow Representation */}
              <div className="lg:col-span-5">
                <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      LexLogic Workflow
                    </span>
                    <Badge variant="purple">Live Matching</Badge>
                  </div>

                  {/* Step 1 Card */}
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">1. Citizen Describes Need</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        "Dispute with neighbour regarding land boundary in Mumbai."
                      </p>
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="flex justify-center my-1 text-indigo-400">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>

                  {/* Step 2 Card */}
                  <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-indigo-200 block">2. Backend Multi-Attribute Engine</span>
                      <p className="text-[11px] text-indigo-300/80 mt-0.5">
                        Analyzes category suitability, court location & verification status.
                      </p>
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="flex justify-center my-1 text-indigo-400">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>

                  {/* Step 3 Card */}
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 block">3. Verified Providers Matched</span>
                        <Badge variant="success" size="sm">Verified</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Advocate Rajesh Sharma • Property Law • 14 Yrs Exp.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* HOW LEXLOGIC WORKS SECTION */}
        <section id="how-it-works" className="py-16 bg-slate-900/50 border-y border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                Simple 3-Step Process
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                How LexLogic Works
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl mx-auto">
                We remove the guesswork from accessing legal services by starting with your problem.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 01 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90 flex flex-col items-center text-center">
                <span className="text-3xl font-extrabold text-indigo-500/40 mb-2">01</span>
                <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Describe Your Need</CardTitle>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Tell us what happened in your own words. Select a category or describe your issue freeform.
                </p>
              </Card>

              {/* Step 02 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90 flex flex-col items-center text-center">
                <span className="text-3xl font-extrabold text-purple-500/40 mb-2">02</span>
                <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Get Matched</CardTitle>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  LexLogic identifies relevant providers based on your request and factual suitability.
                </p>
              </Card>

              {/* Step 03 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90 flex flex-col items-center text-center">
                <span className="text-3xl font-extrabold text-emerald-500/40 mb-2">03</span>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Connect</CardTitle>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Review relevant providers, examine factual suitability details, and continue with the service you need.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* WHY LEXLOGIC SECTION */}
        <section id="why-lexlogic" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                Core Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Legal help, without the guesswork.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl w-fit mb-4">
                  <Search className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Service-First Matching</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Start with your problem, not a provider category. LexLogic determines suitable provider types automatically.
                </CardDescription>
              </Card>

              {/* Feature 2 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Verified Providers</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Discover providers with verified profile information, bar council credentials, and practice areas.
                </CardDescription>
              </Card>

              {/* Feature 3 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Transparent Matching</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-2 leading-relaxed">
                  See factual parameters behind provider suitability without promotional ranking bias.
                </CardDescription>
              </Card>

              {/* Feature 4 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90">
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl w-fit mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Secure Document Sharing</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Keep sensitive documents private and explicitly control who can access them with one-click revocation.
                </CardDescription>
              </Card>

              {/* Feature 5 */}
              <Card className="p-6 border-slate-800 bg-slate-900/90">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-4">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold text-slate-100">Provider Reliability</CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Provider profiles, reliability metrics, and points incentives encourage active service participation.
                </CardDescription>
              </Card>
            </div>
          </div>
        </section>

        {/* DOCUMENT SECURITY SECTION */}
        <section className="py-16 bg-slate-900/60 border-y border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full mb-3">
                <Lock className="w-3.5 h-3.5" />
                <span>Private, Authenticated Document Access</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Your documents stay under your control.
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Upload documents privately, explicitly share them with a provider, and revoke access when you choose.
              </p>
            </div>

            {/* Document Lifecycle Visual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-indigo-400">1. Private Upload</span>
                <p className="text-[11px] text-slate-400">File stored securely in private disk storage.</p>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-purple-400">2. Explicit Share</span>
                <p className="text-[11px] text-slate-400">Citizen grants access to a specific provider ID.</p>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-sky-400">3. Provider Access</span>
                <p className="text-[11px] text-slate-400">Provider streams file with RBAC token check.</p>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                <span className="text-xs font-bold text-rose-400">4. Revoke Access</span>
                <p className="text-[11px] text-slate-400">Citizen revokes grant. Provider access returns 403.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CITIZEN / PROVIDER SPLIT SECTION */}
        <section id="for-citizens" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* For Citizens */}
              <Card className="p-8 border-slate-800 bg-slate-900/90 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <Badge variant="success">For Citizens</Badge>
                  <h3 className="text-xl font-bold text-slate-100">Find Legal Help</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Describe your legal need and discover relevant service providers without needing to know which professional you need first.
                  </p>
                </div>

                <Link to="/register">
                  <Button variant="primary" size="md" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Find Legal Help
                  </Button>
                </Link>
              </Card>

              {/* For Providers */}
              <Card id="for-providers" className="p-8 border-slate-800 bg-slate-900/90 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <Badge variant="purple">For Providers</Badge>
                  <h3 className="text-xl font-bold text-slate-100">Grow Your Practice</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    Build a complete profile, maintain availability, improve reliability, and receive relevant service requests.
                  </p>
                </div>

                <Link to="/login">
                  <Button variant="secondary" size="md" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Provider Sign In
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </section>

        {/* TRUST / PRODUCT PRINCIPLES */}
        <section className="py-12 bg-slate-900/40 border-y border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              LexLogic Core Principles
            </span>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge variant="indigo">Service-First</Badge>
              <Badge variant="success">Transparent</Badge>
              <Badge variant="info">Secure</Badge>
              <Badge variant="purple">Provider-Neutral</Badge>
              <Badge variant="warning">Citizen-Controlled</Badge>
            </div>
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto px-4 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Start with your legal need.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Describe what you need. LexLogic helps you find the right place to start.
            </p>
            <div className="pt-2">
              <Link to="/register">
                <Button variant="primary" size="lg" className="px-8" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* PUBLIC FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-slate-100">LexLogic</span>
            </div>
            <p className="text-xs text-slate-400">
              Service-First Legal Access & Transparent Provider Matching Platform
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400">
            <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</a>
            <a href="#why-lexlogic" className="hover:text-slate-200 transition-colors">Why LexLogic</a>
            <a href="#for-citizens" className="hover:text-slate-200 transition-colors">For Citizens</a>
            <a href="#for-providers" className="hover:text-slate-200 transition-colors">For Providers</a>
            <Link to="/login" className="hover:text-slate-200 transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
