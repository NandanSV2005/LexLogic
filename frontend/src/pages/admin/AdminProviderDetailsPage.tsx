import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  User,
  MapPin,
  Phone,
  Clock,
  Briefcase,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { providersApi } from '../../api';
import { Provider, VerificationStatus } from '../../types';

export const AdminProviderDetailsPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProviderDetails = async () => {
    if (!providerId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await providersApi.getPublicProfile(Number(providerId));
      setProvider(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load provider profile details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderDetails();
  }, [providerId]);

  const handleVerifyDecision = async (status: VerificationStatus) => {
    if (!provider) return;

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const updated = await providersApi.verifyProvider(provider.id, status);
      setProvider(updated);
      setSuccessMessage(`Provider #${provider.id} status updated to ${status}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update verification status.');
    } finally {
      setIsUpdating(false);
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
      <AdminNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/admin/providers"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Provider Registry
        </Link>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching provider details for admin verification review..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Provider Inspection Error"
            message={errorMessage}
            onRetry={fetchProviderDetails}
            className="mb-6"
          />
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-200">
              ✕
            </button>
          </div>
        )}

        {!isLoading && provider && (
          <div className="space-y-6">
            {/* Header Identity Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-100">{provider.full_name}</h1>
                    <Badge variant="purple">{provider.provider_type}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Provider ID: #{provider.id} • User Account ID: #{provider.user_id}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {renderVerificationBadge(provider.verification_status)}
                </div>
              </div>

              {/* Admin Action Bar */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-slate-400">
                  Verification Decision Actions:
                </span>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isUpdating}
                    onClick={() => handleVerifyDecision(VerificationStatus.VERIFIED)}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Approve Verification
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={isUpdating}
                    onClick={() => handleVerifyDecision(VerificationStatus.REJECTED)}
                    leftIcon={<XCircle className="w-4 h-4" />}
                  >
                    Reject Verification
                  </Button>
                </div>
              </div>
            </Card>

            {/* Fact Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Location Jurisdiction
                </div>
                <span className="text-sm font-bold text-slate-100">{provider.location || 'Not Specified'}</span>
              </Card>

              <Card className="p-4 border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="w-4 h-4 text-amber-400" /> Professional Experience
                </div>
                <span className="text-sm font-bold text-slate-100">{provider.experience_years} Years</span>
              </Card>

              <Card className="p-4 border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Profile Completion
                </div>
                <span className="text-sm font-bold text-indigo-400">{provider.profile_completion_percentage ?? 100}%</span>
              </Card>
            </div>

            {/* Professional Biography */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4 text-indigo-400" /> Professional Biography / Summary
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
                "{provider.bio || 'No professional biography provided.'}"
              </p>
            </Card>

            {/* Registration Details & Practice Areas */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <Briefcase className="w-4 h-4 text-purple-400" /> License & Practice Area Specifications
              </div>

              {provider.generic_fields && provider.generic_fields.length > 0 ? (
                <div className="space-y-3">
                  {provider.generic_fields.map((field, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-400 uppercase tracking-wide">
                        {field.field_label || field.field_name}:
                      </span>
                      <span className="font-bold text-slate-100">{field.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No generic registration fields updated.</p>
              )}
            </Card>

            {/* Reliability & Engagement Metrics */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-300 font-semibold text-xs uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-sky-400" /> Reliability & Service Metrics
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Reliability Score</span>
                  <span className="text-base font-bold text-indigo-400">{provider.reliability_score?.toFixed(1) || 'N/A'} / 100</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Response Rate</span>
                  <span className="text-base font-bold text-emerald-400">{provider.response_rate?.toFixed(1) || 0}%</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Completed Requests</span>
                  <span className="text-base font-bold text-sky-400">{provider.completed_requests || 0}</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Incentive Points</span>
                  <span className="text-base font-bold text-amber-400">{provider.points || 0} pts</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
