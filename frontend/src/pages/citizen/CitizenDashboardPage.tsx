import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardTitle, CardDescription } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { requestsApi, documentsApi } from '../../api';
import { ServiceRequest, RequestStatus, DocumentItem } from '../../types';
import {
  Search,
  UserCheck,
  Plus,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  FolderLock,
  ExternalLink,
} from 'lucide-react';

export const CitizenDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [reqData, docData] = await Promise.all([
        requestsApi.listMyRequests(),
        documentsApi.listMyDocuments().catch(() => []),
      ]);
      setRequests(reqData);
      setDocuments(docData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const renderStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.OPEN:
        return <Badge variant="info">Open</Badge>;
      case RequestStatus.MATCHED:
        return <Badge variant="purple">Matched</Badge>;
      case RequestStatus.CONTACTED:
        return <Badge variant="warning">Contacted</Badge>;
      case RequestStatus.IN_PROGRESS:
        return <Badge variant="primary">In Progress</Badge>;
      case RequestStatus.COMPLETED:
        return <Badge variant="success">Completed</Badge>;
      case RequestStatus.CANCELLED:
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & User Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">Citizen Portal</h1>
              <Badge variant="success">Citizen Role</Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Service-first legal assistance, transparent provider matching & private document vault
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Logged in as</span>
            <span className="font-semibold text-slate-200">{user?.email}</span>
          </div>
        </div>

        {/* PROMINENT PRIMARY HERO CTA */}
        <div className="mb-10 p-6 sm:p-8 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/40 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Service-First Matching Engine</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight">
              Have a legal issue? Describe what you need in plain words.
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You do not need to know whether you require an Advocate, Mediator, Arbitrator, Notary, or Document Writer. LexLogic's backend multi-attribute matching engine will analyze your requirement and match you with verified providers.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link to="/citizen/request/new">
                <Button
                  variant="primary"
                  size="lg"
                  className="px-7 py-3 text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30"
                  leftIcon={<Plus className="w-4 h-4" />}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Describe Your Legal Need
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* THREE CORE CONCEPT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Card 1: Describe Legal Need */}
          <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between">
            <div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl w-fit mb-4">
                <Search className="w-6 h-6" />
              </div>
              <CardTitle className="text-base font-bold text-slate-100">Find Legal Assistance</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Describe your issue and let LexLogic find relevant service providers.
              </CardDescription>
              <p className="text-xs text-slate-400 leading-relaxed mt-3">
                Service-first matching with qualified legal advocates, mediators, arbitrators, notaries, and document writers.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link to="/citizen/request/new">
                <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Start a New Matching Request
                </Button>
              </Link>
            </div>
          </Card>

          {/* Card 2: Private Document Vault */}
          <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between">
            <div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl w-fit mb-4">
                <FolderLock className="w-6 h-6" />
              </div>
              <CardTitle className="text-base font-bold text-slate-100">Private Document Vault</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Secure file storage & explicit access sharing
              </CardDescription>
              <p className="text-xs text-slate-400 leading-relaxed mt-3">
                Upload confidential deeds and contracts. Explicitly grant or revoke access to providers on demand.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {documents.length} File{documents.length === 1 ? '' : 's'} Stored
              </span>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Encrypted Storage
              </span>
            </div>
          </Card>

          {/* Card 3: Service Requests */}
          <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between">
            <div>
              <div className="p-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl w-fit mb-4">
                <UserCheck className="w-6 h-6" />
              </div>
              <CardTitle className="text-base font-bold text-slate-100">Service Requests</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Track active inquiries & provider responses
              </CardDescription>
              <p className="text-xs text-slate-400 leading-relaxed mt-3">
                Monitor status progression from Open to Matched, In Progress, and Completed.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {requests.length} Total Request{requests.length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-indigo-400 font-semibold">
                {requests.filter((r) => r.status === RequestStatus.OPEN || r.status === RequestStatus.MATCHED).length} Active
              </span>
            </div>
          </Card>
        </div>

        {/* ACTIVE SERVICE REQUESTS SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">Your Service Requests</h2>
              <p className="text-xs text-slate-400">View matches or monitor progress for your submitted requests.</p>
            </div>

            <Link to="/citizen/request/new">
              <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                Create Request
              </Button>
            </Link>
          </div>

          {isLoading && (
            <div className="py-12">
              <LoadingState message="Loading your service requests..." />
            </div>
          )}

          {errorMessage && !isLoading && (
            <ErrorState
              title="Failed to Load Requests"
              message={errorMessage}
              onRetry={fetchDashboardData}
            />
          )}

          {!isLoading && !errorMessage && requests.length === 0 && (
            <EmptyState
              title="No Service Requests Yet"
              description="You have not submitted any legal service requests. Describe your legal need to find verified providers."
              actionLabel="Describe Your Legal Need Now"
              onAction={() => window.location.href = '/citizen/request/new'}
            />
          )}

          {!isLoading && !errorMessage && requests.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-all shadow-md"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-indigo-300">Request #{req.id}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs font-semibold text-slate-200">{req.service_category}</span>
                      {renderStatusBadge(req.status)}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {req.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {req.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {req.urgency} Urgency
                      </span>
                      <span>
                        Created: {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/citizen/matches/${req.id}`}>
                      <Button variant="primary" size="sm" rightIcon={<Sparkles className="w-3.5 h-3.5" />}>
                        View Matches
                      </Button>
                    </Link>

                    <Link to={`/citizen/requests/${req.id}`}>
                      <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
