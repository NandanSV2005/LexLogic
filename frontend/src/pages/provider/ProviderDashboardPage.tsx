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
import { getProviderProfessionConfig } from '../../config/providerConfig';
import {
  Provider,
  ProviderType,
  ProviderDashboardMetrics,
  ServiceRequest,
  RequestStatus,
  AvailabilityStatus,
  VerificationStatus,
  DetailedVerificationStatus,
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
  Eye,
  X,
  Briefcase,
  AlertTriangle,
  Award,
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
  const [confirmExpressInterestReq, setConfirmExpressInterestReq] = useState<ServiceRequest | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const profConfig = getProviderProfessionConfig(profile?.provider_type);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profData = await providersApi.getMe();
      setProfile(profData);

      // Check Advocate / Provider verification record
      let vRecord = null;
      try {
        vRecord = await providersApi.getVerificationRecord();
      } catch (e) {
        // Ignored if verification endpoint fails
      }

      // Check if profile or verification is incomplete
      const isAdvocateVerificationIncomplete =
        profData.provider_type === ProviderType.ADVOCATE &&
        (!vRecord ||
          vRecord.overall_status === DetailedVerificationStatus.NOT_STARTED ||
          !vRecord.advocate_profile?.enrollment_number);

      if (!profData.is_profile_complete || isAdvocateVerificationIncomplete) {
        navigate('/provider/onboarding', { replace: true });
        return;
      }

      const [metricData, eligibleData, caseData, pointsData] = await Promise.all([
        providersApi.getDashboard(),
        requestsApi.getEligibleRequests(),
        requestsApi.listMyProviderCases(),
        providersApi.getPointsHistory().catch(() => []),
      ]);

      setMetrics(metricData);
      setEligibleRequests(eligibleData);
      setMyCases(caseData);
      setPointsHistory(pointsData);
    } catch (err: any) {
      const is403 = err?.status === 403 || err?.response?.status === 403;
      const msg = (err?.message || '').toLowerCase();
      const isIncomplete = is403 || msg.includes('incomplete') || msg.includes('profile') || msg.includes('forbidden');

      if (isIncomplete) {
        navigate('/provider/onboarding', { replace: true });
        return;
      }
      setErrorMessage(err?.message || 'Failed to load provider dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleAvailability = async (newStatus: AvailabilityStatus) => {
    if (!profile) return;
    setIsUpdatingAvailability(true);
    setErrorMessage(null);

    try {
      const updated = await providersApi.updateAvailability(newStatus);
      setProfile(updated);
      setSuccessMessage(`Availability updated to "${newStatus}"!`);
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

  const handleRespondRequestConfirmed = async (requestId: number) => {
    setActionLoadingId(requestId);
    setErrorMessage(null);
    setConfirmExpressInterestReq(null);

    try {
      await requestsApi.respondToRequest(requestId, 'ACCEPT');
      setSuccessMessage(`Expressed interest in Request #${requestId}! Added to Pending Interests.`);
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to express interest in request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRequestCompletion = async (requestId: number) => {
    setActionLoadingId(requestId);
    setErrorMessage(null);

    try {
      await requestsApi.requestCompletion(requestId);
      setSuccessMessage(`Requested completion for Request #${requestId}! Awaiting Citizen confirmation.`);
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to request completion for service.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderVerificationBadge = (status?: VerificationStatus) => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return <Badge variant="success">Verified {profConfig.label}</Badge>;
      case VerificationStatus.SUBMITTED:
        return <Badge variant="warning">Submitted for Review</Badge>;
      case VerificationStatus.REJECTED:
        return <Badge variant="danger">Rejected</Badge>;
      case VerificationStatus.PENDING:
      default:
        return <Badge variant="neutral">Pending Verification</Badge>;
    }
  };

  const [docModalCase, setDocModalCase] = useState<ServiceRequest | null>(null);
  const [requestedDocsInput, setRequestedDocsInput] = useState<string>('');
  const [isSubmittingDocs, setIsSubmittingDocs] = useState<boolean>(false);

  const handleOpenDocModal = (req: ServiceRequest) => {
    setDocModalCase(req);
    setRequestedDocsInput('');
  };

  const handleSaveDocRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docModalCase || !requestedDocsInput.trim()) return;

    setIsSubmittingDocs(true);
    setErrorMessage(null);

    try {
      await requestsApi.requestDocuments(docModalCase.id, requestedDocsInput.trim());
      setSuccessMessage(`Document request sent to Citizen for Request #${docModalCase.id}!`);
      setDocModalCase(null);
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit document request.');
    } finally {
      setIsSubmittingDocs(false);
    }
  };

  // Split interacted cases into clear backend status categories
  const activeCases = myCases.filter(
    (r) => r.status === RequestStatus.IN_PROGRESS || r.status === RequestStatus.COMPLETION_REQUESTED
  );
  const pendingInterestCases = myCases.filter(
    (r) => r.status === RequestStatus.CONTACTED || r.status === RequestStatus.OPEN
  );
  const completedCases = myCases.filter((r) => r.status === RequestStatus.COMPLETED);

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
                {profile?.full_name || `${profConfig.label} Portal`}
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#1C261F] text-[#E6EFE8] border border-[#2D3D32]">
                {profConfig.professionTitle}
              </span>
              {renderVerificationBadge(profile?.verification_status)}
            </div>
            <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1">
              Workspace for {profConfig.label.toLowerCase()} request matching, {profConfig.activeWorkLabel.toLowerCase()} management, and incentive tracking.
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
          <div className="p-4 bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] text-xs rounded-xl flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#7ECB98]" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-[#7ECB98] hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="py-20">
            <LoadingState message={`Fetching ${profConfig.label} metrics & profile data...`} />
          </div>
        )}

        {!isLoading && profile && metrics && (
          <div className="space-y-8">
            {/* TOP SUMMARY METRIC CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    {profConfig.activeWorkLabel}
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {activeCases.length}
                </span>
                <span className="text-[11px] text-[#A3B5A7] mt-1 block">Active engagements</span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    {profConfig.completionLabel}
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {metrics.completed_requests}
                </span>
                <span className="text-[11px] text-[#8EA895] mt-1 block font-semibold">
                  {metrics.completed_requests > 0 ? 'Resolutions completed' : 'No resolutions yet'}
                </span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Reliability Score
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#B3A7CF] border border-[#2D3D32] rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {metrics.reliability_score.toFixed(1)} <span className="text-xs text-[#A3B5A7] font-normal">/ 100</span>
                </span>
                <span className="text-[11px] text-[#B3A7CF] mt-1 block font-semibold">
                  Response Rate: {metrics.response_rate}%
                </span>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Incentive Points
                  </span>
                  <div className="p-2 bg-[#1C261F] text-[#E89D9D] border border-[#2D3D32] rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-[#E6EFE8] mt-2 block">
                  {metrics.points} <span className="text-xs text-[#A3B5A7] font-normal">pts</span>
                </span>
                <span className="text-[11px] text-[#A3B5A7] mt-1 block">Earned from engagement</span>
              </Card>
            </div>

            {/* CONTROLS GRID: AVAILABILITY & VERIFICATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* AVAILABILITY TOGGLE WIDGET */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#8EA895]" />
                    <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider">
                      Availability Control
                    </h3>
                  </div>

                  <span className="text-xs font-semibold text-[#7ECB98] bg-[#1B3B2B] border border-[#2D5E44] px-2.5 py-1 rounded-lg">
                    Current: {profile.availability_status}
                  </span>
                </div>

                <p className="text-xs text-[#A3B5A7]">
                  Toggle availability status for receiving new citizen matching recommendations.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.AVAILABLE)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      profile.availability_status === AvailabilityStatus.AVAILABLE
                        ? 'bg-[#1B3B2B] border-[#2D5E44] text-[#7ECB98]'
                        : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#8EA895]'
                    }`}
                  >
                    Available
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.BUSY)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      profile.availability_status === AvailabilityStatus.BUSY
                        ? 'bg-[#3B301D] border-[#5E4D2E] text-[#E3BA7E]'
                        : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#8EA895]'
                    }`}
                  >
                    Busy
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingAvailability}
                    onClick={() => handleToggleAvailability(AvailabilityStatus.UNAVAILABLE)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      profile.availability_status === AvailabilityStatus.UNAVAILABLE
                        ? 'bg-[#3D2020] border-[#5E3232] text-[#E89D9D]'
                        : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#8EA895]'
                    }`}
                  >
                    Unavailable
                  </button>
                </div>
              </Card>

              {/* VERIFICATION WIDGET */}
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#8EA895]" />
                    <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider">
                      Verification Status
                    </h3>
                  </div>

                  {renderVerificationBadge(profile.verification_status)}
                </div>

                <p className="text-xs text-[#A3B5A7]">
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
                    <div className="p-3 bg-[#3B301D] border border-[#5E4D2E] rounded-xl text-[#E3BA7E] text-xs text-center font-semibold">
                      Under review by LexLogic admin verification team
                    </div>
                  ) : profile.verification_status === VerificationStatus.VERIFIED ? (
                    <div className="p-3 bg-[#1B3B2B] border border-[#2D5E44] rounded-xl text-[#7ECB98] text-xs text-center font-semibold">
                      ✓ Profile is fully verified for service delivery
                    </div>
                  ) : (
                    <div className="p-3 bg-[#3D2020] border border-[#5E3232] rounded-xl text-[#E89D9D] text-xs text-center font-semibold">
                      Verification rejected. Please update details and re-submit.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* SECTION 1: ACTIVE WORK FEED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#E6EFE8] tracking-tight flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#8EA895]" /> {profConfig.activeWorkLabel} ({activeCases.length})
                  </h3>
                  <p className="text-xs text-[#A3B5A7]">
                    Service requests accepted by citizen where active representation is underway.
                  </p>
                </div>
              </div>

              {activeCases.length === 0 ? (
                <EmptyState
                  title={`No ${profConfig.activeWorkLabel} Currently Active`}
                  description={`Once a citizen accepts your expressed interest, the request will move here as active work.`}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeCases.map((req) => (
                    <Card key={req.id} className="p-5 space-y-3 ring-2 ring-[#8EA895]">
                      <div className="flex items-center justify-between border-b border-[#2D3D32] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#8EA895]">Request #{req.id}</span>
                          <Badge variant="info">{req.service_category}</Badge>
                        </div>
                        {req.status === RequestStatus.COMPLETION_REQUESTED ? (
                          <Badge variant="warning">Completion Requested</Badge>
                        ) : (
                          <Badge variant="success">IN PROGRESS</Badge>
                        )}
                      </div>

                      <p className="text-xs text-[#E6EFE8] line-clamp-3 leading-relaxed">
                        "{req.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[#A3B5A7] pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#8EA895]" /> {req.location}
                        </span>
                        <span className="text-[#A3B5A7] font-semibold">Status: {req.status}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2D3D32]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCase(req)}
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                          >
                            View Details
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDocModal(req)}
                            leftIcon={<FileText className="w-3.5 h-3.5 text-[#8EA895]" />}
                          >
                            Request Docs
                          </Button>
                        </div>

                        {req.status === RequestStatus.IN_PROGRESS && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoadingId === req.id}
                            onClick={() => handleRequestCompletion(req.id)}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Mark Completed
                          </Button>
                        )}

                        {req.status === RequestStatus.COMPLETION_REQUESTED && (
                          <span className="text-xs text-[#E3BA7E] font-semibold flex items-center gap-1 bg-[#3B301D] px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-[#E3BA7E]" /> Awaiting Citizen Confirmation
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: PENDING INTEREST EXPRESSED FEED */}
            {pendingInterestCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#E6EFE8] tracking-tight flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#B3A7CF]" /> Pending Citizen Review ({pendingInterestCases.length})
                    </h3>
                    <p className="text-xs text-[#A3B5A7]">
                      Requests where you expressed interest and are awaiting citizen acceptance.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingInterestCases.map((req) => (
                    <Card key={req.id} className="p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#2D3D32] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#8EA895]">Request #{req.id}</span>
                          <Badge variant="info">{req.service_category}</Badge>
                        </div>
                        <Badge variant="purple">Interest Submitted</Badge>
                      </div>

                      <p className="text-xs text-[#E6EFE8] line-clamp-2 leading-relaxed">
                        "{req.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[#A3B5A7] pt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#8EA895]" /> {req.location}
                        </span>
                        <span className="text-[#A3B5A7]">Awaiting Citizen Decision</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2D3D32]">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCase(req)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Details
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: ELIGIBLE SERVICE REQUESTS FEED */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#E6EFE8] tracking-tight">
                    {profConfig.eligibleRequestsHeading} ({eligibleRequests.length})
                  </h3>
                  <p className="text-xs text-[#A3B5A7]">
                    Open citizen requests matching your profession ({profConfig.label}) that you haven't responded to yet.
                  </p>
                </div>
              </div>

              {eligibleRequests.length === 0 ? (
                <EmptyState
                  title={`No ${profConfig.eligibleRequestsHeading} Available`}
                  description={`No open service requests match your profession category (${profConfig.label}) currently.`}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {eligibleRequests.map((req) => (
                    <Card key={req.id} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#8EA895]">Request #{req.id}</span>
                            <span className="text-[#A3B5A7]">•</span>
                            <span className="text-xs font-semibold text-[#E6EFE8]">{req.service_category}</span>
                            <Badge variant="info">{req.urgency} Urgency</Badge>
                            {req.legal_aid_interest && (
                              <Badge variant="purple">Legal Aid Flagged (+30 pts)</Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#E6EFE8] line-clamp-2 leading-relaxed">
                            {req.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#A3B5A7] pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#8EA895] shrink-0" /> {req.location}
                            </span>
                            <span>Created: {new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={actionLoadingId === req.id}
                            onClick={() => setConfirmExpressInterestReq(req)}
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

            {/* SECTION 4: COMPLETED ENGAGEMENTS */}
            {completedCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#E6EFE8] tracking-tight flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#7ECB98]" /> Completed Resolutive Services ({completedCases.length})
                    </h3>
                    <p className="text-xs text-[#A3B5A7]">
                      Historical archive of completed services.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedCases.map((req) => (
                    <Card key={req.id} className="p-5 space-y-3 bg-[#1C261F]">
                      <div className="flex items-center justify-between border-b border-[#2D3D32] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#8EA895]">Request #{req.id}</span>
                          <Badge variant="info">{req.service_category}</Badge>
                        </div>
                        <Badge variant="success">COMPLETED</Badge>
                      </div>

                      <p className="text-xs text-[#E6EFE8] line-clamp-2 leading-relaxed">
                        "{req.description}"
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-[#A3B5A7] pt-1">
                        <span>Location: {req.location}</span>
                        <span className="text-[#7ECB98] font-semibold">✓ Closed & Awarded</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* INCENTIVE POINTS LEDGER */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2D3D32]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E89D9D]" />
                  <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider">
                    Incentive Points Ledger
                  </h3>
                </div>

                <span className="text-xs font-bold text-[#E6EFE8] bg-[#1C261F] border border-[#2D3D32] px-3 py-1 rounded-xl">
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
                    <div key={tx.id} className="p-3 bg-[#1C261F] rounded-xl border border-[#2D3D32] flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#E6EFE8] block">{tx.action}</span>
                        {tx.description && <span className="text-[#A3B5A7] text-[11px]">{tx.description}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-[#7ECB98]">+{tx.points_awarded} pts</span>
                        <span className="text-[#A3B5A7] text-[10px] block">
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

      {/* CONFIRM EXPRESS INTEREST MODAL */}
      {confirmExpressInterestReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#8EA895]" />
                <h3 className="text-base font-bold text-[#E6EFE8]">
                  Confirm Express Interest
                </h3>
              </div>
              <button
                onClick={() => setConfirmExpressInterestReq(null)}
                className="text-[#A3B5A7] hover:text-[#E6EFE8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#E6EFE8]">
                Are you sure you want to express interest in this request as a <strong className="text-[#8EA895]">{profConfig.label}</strong>?
              </p>

              <div className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#E6EFE8]">Request #{confirmExpressInterestReq.id}</span>
                  <Badge variant="info">{confirmExpressInterestReq.service_category}</Badge>
                </div>
                <p className="text-[#A3B5A7] line-clamp-2">
                  "{confirmExpressInterestReq.description}"
                </p>
                <div className="flex items-center gap-3 text-[11px] text-[#A3B5A7] pt-1">
                  <span>Location: {confirmExpressInterestReq.location}</span>
                  <span>Urgency: {confirmExpressInterestReq.urgency}</span>
                </div>
              </div>

              <div className="p-3 bg-[#3B301D] border border-[#5E4D2E] rounded-xl text-[#E3BA7E] text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E3BA7E] shrink-0 mt-0.5" />
                <span>
                  Expressing interest notifies the citizen and adds this item to your <strong>Pending Interests</strong>. It does NOT automatically grant document access.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2D3D32]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmExpressInterestReq(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={actionLoadingId === confirmExpressInterestReq.id}
                onClick={() => handleRespondRequestConfirmed(confirmExpressInterestReq.id)}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Express Interest
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CASE DETAILS MODAL */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#8EA895]" />
                <h3 className="text-base font-bold text-[#E6EFE8]">
                  {profConfig.label} Case Details — Request #{selectedCase.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-[#A3B5A7] hover:text-[#E6EFE8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Service Category</span>
                <span className="text-[#E6EFE8] text-sm font-semibold">{selectedCase.service_category}</span>
              </div>

              <div>
                <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Service Need Description</span>
                <p className="text-[#E6EFE8] leading-relaxed bg-[#1C261F] p-3 rounded-xl border border-[#2D3D32]">
                  {selectedCase.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Location</span>
                  <span className="text-[#E6EFE8] font-bold">{selectedCase.location}</span>
                </div>
                <div>
                  <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Urgency</span>
                  <Badge variant="info">{selectedCase.urgency}</Badge>
                </div>
                <div>
                  <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Legal Aid Interest</span>
                  <span className="text-[#E6EFE8] font-bold">
                    {selectedCase.legal_aid_interest ? 'Yes (Pro-bono flagged)' : 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-[#A3B5A7] font-bold uppercase text-[10px] block">Created Date</span>
                  <span className="text-[#E6EFE8] font-bold">
                    {new Date(selectedCase.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2D3D32]">
              <Button variant="outline" size="sm" onClick={() => setSelectedCase(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* REQUEST DOCUMENTS MODAL */}
      {docModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8EA895]" />
                <h3 className="text-base font-bold text-[#E6EFE8]">
                  Request Documents from Citizen — Request #{docModalCase.id}
                </h3>
              </div>
              <button
                onClick={() => setDocModalCase(null)}
                className="text-[#A3B5A7] hover:text-[#E6EFE8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocRequest} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wide">
                  Specify Required Documents / Case Details
                </label>
                <textarea
                  rows={4}
                  value={requestedDocsInput}
                  onChange={(e) => setRequestedDocsInput(e.target.value)}
                  required
                  placeholder="e.g. Property Title Deed, Sale Agreement, Identification Proof (Aadhaar/PAN), Tax Receipts..."
                  className="w-full px-3.5 py-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] placeholder-[#74887A] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2D3D32]">
                <Button variant="outline" size="sm" onClick={() => setDocModalCase(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingDocs}>
                  Send Request to Citizen
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
