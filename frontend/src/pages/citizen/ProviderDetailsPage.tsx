import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Scale,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  UserCheck,
  Building2,
  Briefcase,
  Star,
  Award,
  FileText,
  PhoneCall,
  Lock,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { providersApi } from '../../api';
import {
  Provider,
  ProviderType,
  VerificationStatus,
  AvailabilityStatus,
} from '../../types';

export const ProviderDetailsPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProviderProfile = async () => {
    if (!providerId || isNaN(Number(providerId))) {
      setErrorMessage('Invalid provider ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await providersApi.getPublicProfile(Number(providerId));
      setProvider(data);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        setErrorMessage('Provider profile not found.');
      } else {
        setErrorMessage(err.message || 'Failed to load provider profile details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderProfile();
  }, [providerId]);

  const renderProviderTypeBadge = (type: ProviderType) => {
    switch (type) {
      case ProviderType.ADVOCATE:
        return <Badge variant="info">Advocate</Badge>;
      case ProviderType.MEDIATOR:
        return <Badge variant="purple">Mediator</Badge>;
      case ProviderType.ARBITRATOR:
        return <Badge variant="warning">Arbitrator</Badge>;
      case ProviderType.NOTARY:
        return <Badge variant="success">Notary</Badge>;
      case ProviderType.DOCUMENT_WRITER:
        return <Badge variant="neutral">Document Writer</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const isAdvocate = provider?.provider_type === ProviderType.ADVOCATE;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Previous View
        </button>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching provider profile details..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Provider Not Found"
            message={errorMessage}
            onRetry={fetchProviderProfile}
            className="my-8 max-w-2xl mx-auto"
          />
        )}

        {!isLoading && !errorMessage && provider && (
          <div className="space-y-8">
            {/* Main Header Card */}
            <Card className="p-6 sm:p-8 border-slate-800 bg-slate-900/90 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderProviderTypeBadge(provider.provider_type)}

                    {provider.verification_status === VerificationStatus.VERIFIED ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified Provider
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5" /> Verification Pending
                      </span>
                    )}

                    {isAdvocate && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Citizen-initiated match
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                      {provider.full_name}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Provider ID #{provider.id}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">
                        {provider.availability_status === AvailabilityStatus.AVAILABLE
                          ? 'Available for consultations'
                          : provider.availability_status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {provider.bio && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Professional Biography
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    {provider.bio}
                  </p>
                </div>
              )}
            </Card>

            {/* Factual Performance & Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Location</span>
                    <span className="text-sm font-bold text-slate-100">{provider.location || 'Not Specified'}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Experience</span>
                    <span className="text-sm font-bold text-slate-100">{provider.experience_years} Years</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">Completed Cases</span>
                    <span className="text-sm font-bold text-slate-100">{provider.completed_requests} Requests</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* WHY THIS PROVIDER MATCHES SECTION */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Why this provider matches
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200 block">Jurisdiction & Location Match</span>
                    <span className="text-slate-400 text-[11px]">
                      Operates within {provider.location || 'matching location'} jurisdiction.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200 block">Service Compatibility</span>
                    <span className="text-slate-400 text-[11px]">
                      Registered as {provider.provider_type} providing relevant legal assistance.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200 block">Verification Status</span>
                    <span className="text-slate-400 text-[11px]">
                      Status is {provider.verification_status}. Platform verification protocol applied.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200 block">Reliability & Practice Record</span>
                    <span className="text-slate-400 text-[11px]">
                      System reliability score: {provider.reliability_score?.toFixed(1)} / 100.
                    </span>
                  </div>
                </div>
              </div>

              {isAdvocate && (
                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 italic text-center">
                  Factual non-promotional advocate listing. No paid rankings or promotional badges displayed per Bar Council rules.
                </div>
              )}
            </Card>

            {/* Practice Areas & Registration (Generic Fields) */}
            {provider.generic_fields && provider.generic_fields.length > 0 && (
              <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
                  Registration & Practice Specifications
                </h3>

                <div className="space-y-3">
                  {provider.generic_fields.map((field, idx) => (
                    field.value ? (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                        <span className="font-semibold text-slate-400 uppercase text-[11px] tracking-wide">
                          {field.field_label || field.field_name}
                        </span>
                        <span className="text-slate-100 font-medium mt-1 sm:mt-0">
                          {field.value}
                        </span>
                      </div>
                    ) : null
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
