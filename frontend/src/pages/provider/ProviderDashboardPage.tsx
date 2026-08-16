import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { providersApi, requestsApi } from '../../api';
import {
  Provider,
  ProviderDashboardMetrics,
  ServiceRequest,
  AvailabilityStatus,
  VerificationStatus,
  PointTransactionOut,
} from '../../types';
import {
  UserCheck,
  ShieldCheck,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  RefreshCw,
  Edit3,
  TrendingUp,
  Send,
  Check,
  Eye,
  X,
  Briefcase,
  AlertCircle,
} from 'lucide-react';

export const ProviderDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Provider | null>(null);
  const [metrics, setMetrics] = useState<ProviderDashboardMetrics | null>(null);
  const [eligibleRequests, setEligibleRequests] = useState<ServiceRequest[]>([]);
  const [myCases, setMyCases] = useState<ServiceRequest[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointTransactionOut[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [selectedCase, setSelectedCase] = useState<ServiceRequest | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [profData, dashData, reqData, casesData, historyData] = await Promise.all([
        providersApi.getMe(),
        providersApi.getDashboard(),
        requestsApi.getEligibleRequests().catch(() => []),
        requestsApi.listMyProviderCases().catch(() => []),
        providersApi.getPointsHistory().catch(() => []),
      ]);

      if (profData && (!profData.is_profile_complete || profData.profile_completion_percentage < 100)) {
        navigate('/provider/onboarding', { replace: true });
        return;
      }

      setProfile(profData);
      setMetrics(dashData);
      setEligibleRequests(reqData);
      setMyCases(casesData);
      setPointsHistory(historyData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load provider dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleAvailability = async (targetStatus: AvailabilityStatus) => {
    if (!profile || profile.availability_status === targetStatus) return;

    setIsUpdatingAvailability(true);
    setErrorMessage(null);

    try {
      const updated = await providersApi.updateAvailability(targetStatus);
      setProfile(updated);
      if (metrics) {
        setMetrics({ ...metrics, availability_status: targetStatus });
      }
      setSuccessMessage(`Availability updated to ${targetStatus}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update availability status.');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const handleSubmitVerification = async () => {
    setIsSubmittingVerification(true);
    setErrorMessage(null);

    try {
      const updated = await providersApi.submitVerification('Prototype verification request');
      setProfile(updated);
      if (metrics) {
        setMetrics({ ...metrics, verification_status: VerificationStatus.SUBMITTED });
      }
      setSuccessMessage('Profile submitted for verification review successfully!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit verification request.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const handleRespondRequest = async (requestId: number) => {
    setActionLoadingId(requestId);
    setErrorMessage(null);

    try {
      await requestsApi.respondToRequest(requestId, 'ACCEPT');
      setSuccessMessage(`Expressed interest in Request #${requestId}! Added to Current Cases.`);
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to express interest in request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteRequest = async (requestId: number) => {
    setActionLoadingId(requestId);
    setErrorMessage(null);

    try {
      await requestsApi.completeRequest(requestId);
      setSuccessMessage(`Marked Request #${requestId} as COMPLETED! Points awarded & reliability updated.`);
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderVerificationBadge = (status?: VerificationStatus) => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return <Badge variant="success">Verified Provider</Badge>;
      case VerificationStatus.SUBMITTED:
        return <Badge variant="warning">Submitted for Review</Badge>;
      case VerificationStatus.REJECTED:
        return <Badge variant="danger">Rejected</Badge>;
      case VerificationStatus.PENDING:
      default:
        return <Badge variant="neutral">Pending Verification</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                {profile?.full_name || 'Provider Portal'}
              </h1>
              <Badge variant="purple">{profile?.provider_type || 'PROVIDER'}</Badge>
              {renderVerificationBadge(profile?.verification_status)}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Provider workspace for request matching, active case management, and incentives.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Metrics
            </Button>
            <Link to="/provider/profile">
              <Button variant="primary" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
                Edit Profile
              </Button>
            </Link>
          </div>
        </div>

        {errorMessage && (
          <ErrorState
            title="Dashboard Error"
            message={errorMessage}
            onRetry={fetchDashboardData}
          />
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-200">
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching provider metrics & profile data..." />
          </div>
        )}

        {!isLoading && profile && metrics && (
          <div className="space-y-8">
            {/* TOP SUMMARY METRIC CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    My Active Cases
                  </span>
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">
                  {myCases.length}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Interacted requests</span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Completed Cases
                  </span>
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">
                  {metrics.completed_requests}
                </span>
                <span className="text-[11px] text-emerald-400 mt-1 block font-medium">
                  {metrics.completed_requests > 0 ? 'Case resolution active' : 'No resolutions yet'}
                </span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Reliability Score
                  </span>
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-slate-100 mt-2 block">
                  {metrics.reliability_score.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                </span>
                <span className="text-[11px] text-purple-300 mt-1 block font-medium">
                  Response Rate: {metrics.response_rate}%
                </span>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Incentive Points
                  </span>
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-400 mt-2 block">
                  {metrics.points} <span className="text-xs text-slate-400 font-normal">pts</span>
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">Earned from engagement</span>
              </Card>
            </div>

            {/* CONTROLS GRID: AVAILABILITY & VERIFICATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AVAILABILITY TOGGLE WIDGET */}
              <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Availability Control
                    </h3>
                  </div>

                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    Current: {profile.availability_status}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Toggle availability status for receiving new citizen matching recommendations.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.AVAILABLE)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      profile.availability_status === AvailabilityStatus.AVAILABLE
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Available
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.BUSY)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      profile.availability_status === AvailabilityStatus.BUSY
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Busy
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.UNAVAILABLE)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      profile.availability_status === AvailabilityStatus.UNAVAILABLE
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Unavailable
                  </button>
                </div>
              </Card>

              {/* VERIFICATION WIDGET */}
              <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Verification Status
                    </h3>
                  </div>

                  {renderVerificationBadge(profile.verification_status)}
                </div>

                <p className="text-xs text-slate-400">
                  Verification increases matching score by +15% and displays verified badge.
                </p>

                <div className="pt-2">
                  {profile.verification_status === VerificationStatus.PENDING ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      isLoading={isSubmittingVerification}
                      onClick={handleSubmitVerification}
                    >
                      Submit for Prototype Verification
                    </Button>
                  ) : profile.verification_status === VerificationStatus.SUBMITTED ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs text-center font-medium">
                      Under review by LexLogic admin verification team
                    </div>
                  ) : profile.verification_status === VerificationStatus.VERIFIED ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs text-center font-medium">
                      ✓ Profile is fully verified for legal service delivery
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs text-center font-medium">
                      Verification rejected. Please update details and re-submit.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* CURRENT CASES ("MY CASES") SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" /> Current Cases ({myCases.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Service requests where you have expressed interest or engaged.
                  </p>
                </div>
              </div>

              {myCases.length === 0 ? (
                <EmptyState
                  title="No Active Cases Yet"
                  description="Click 'Express Interest' on eligible requests below to add requests to your current cases feed."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCases.map((req) => (
                    <Card key={req.id} className="p-5 border-slate-800 bg-slate-900/90 shadow-md space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-400">Request #{req.id}</span>
                          <Badge variant="info">{req.service_category}</Badge>
                        </div>
                        <Badge variant="success">INTEREST EXPRESSED</Badge>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                        "{req.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {req.location}
                        </span>
                        <span className="text-slate-500 font-medium">Status: {req.status}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCase(req)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Case Details
                        </Button>

                        {req.status !== 'COMPLETED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            isLoading={actionLoadingId === req.id}
                            onClick={() => handleCompleteRequest(req.id)}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Mark Completed
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ELIGIBLE SERVICE REQUESTS FEED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                    Eligible Service Requests ({eligibleRequests.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Open citizen requests matching your category ({profile.provider_type}) that you haven't responded to yet.
                  </p>
                </div>
              </div>

              {eligibleRequests.length === 0 ? (
                <EmptyState
                  title="No Eligible Requests Available"
                  description={`No open service requests match your category (${profile.provider_type}) currently.`}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {eligibleRequests.map((req) => (
                    <Card key={req.id} className="p-5 border-slate-800 bg-slate-900/90 shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-indigo-300">Request #{req.id}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-xs font-semibold text-slate-200">{req.service_category}</span>
                            <Badge variant="info">{req.urgency} Urgency</Badge>
                            {req.legal_aid_interest && (
                              <Badge variant="purple">Legal Aid Flagged (+30 pts)</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {req.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {req.location}
                            </span>
                            <span>Created: {new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoadingId === req.id}
                            onClick={() => handleRespondRequest(req.id)}
                            leftIcon={<Send className="w-3.5 h-3.5" />}
                          >
                            Express Interest
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* INCENTIVE POINTS LEDGER */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Incentive Points Ledger
                  </h3>
                </div>

                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                  Total Points: {profile.points} pts
                </span>
              </div>

              {pointsHistory.length === 0 ? (
                <EmptyState
                  title="No Points History"
                  description="Complete your profile or respond to citizen requests to earn incentive points."
                />
              ) : (
                <div className="space-y-2">
                  {pointsHistory.map((tx) => (
                    <div key={tx.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-200 block">{tx.action}</span>
                        {tx.description && <span className="text-slate-400 text-[11px]">{tx.description}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-emerald-400">+{tx.points_awarded} pts</span>
                        <span className="text-slate-500 text-[10px] block">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* CASE DETAILS MODAL */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 border-slate-800 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Case Details — Request #{selectedCase.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Service Category</span>
                <span className="text-slate-200 text-sm font-medium">{selectedCase.service_category}</span>
              </div>

              <div>
                <span className="text-slate-500 font-semibold uppercase text-[10px] block">Legal Need Description</span>
                <p className="text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedCase.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Location</span>
                  <span className="text-slate-200 font-medium">{selectedCase.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Urgency</span>
                  <Badge variant="info">{selectedCase.urgency}</Badge>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Legal Aid Interest</span>
                  <span className="text-slate-200 font-medium">
                    {selectedCase.legal_aid_interest ? 'Yes (Pro-bono flagged)' : 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Created Date</span>
                  <span className="text-slate-200 font-medium">
                    {new Date(selectedCase.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedCase(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

