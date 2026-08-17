import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Award,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
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
    <div className="min-h-screen bg-[#E8F0E6] text-[#29352D] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-[#7C9A82] hover:text-[#6B8870] font-semibold mb-6 transition-colors"
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
            <Card className="p-6 sm:p-8 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {renderProviderTypeBadge(provider.provider_type)}

                    {provider.verification_status === VerificationStatus.VERIFIED ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F4724] bg-[#D4E5D4] border border-[#B2D4B2] px-2.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified Provider
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#617066] bg-[#F0F4EC] border border-[#C8D7C7] px-2.5 py-0.5 rounded-md">
                        <Clock className="w-3.5 h-3.5" /> Verification Pending
                      </span>
                    )}

                    {isAdvocate && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#29352D] bg-[#DDE8DC] border border-[#C8D7C7] px-2.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#7C9A82]" /> Citizen-initiated match
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#29352D] tracking-tight">
                      {provider.full_name}
                    </h1>
                    <p className="text-xs text-[#617066] mt-1 flex items-center gap-2">
                      <span>Provider ID #{provider.id}</span>
                      <span>•</span>
                      <span className="text-[#7C9A82] font-semibold">
                        {provider.availability_status === AvailabilityStatus.AVAILABLE
                          ? 'Available for consultations'
                          : provider.availability_status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {provider.bio && (
                <div className="mt-6 pt-6 border-t border-[#C8D7C7]">
                  <h3 className="text-xs font-bold text-[#617066] uppercase tracking-wider mb-2">
                    Professional Biography
                  </h3>
                  <p className="text-xs sm:text-sm text-[#29352D] leading-relaxed bg-[#FAFCF9] p-4 rounded-xl border border-[#C8D7C7]">
                    {provider.bio}
                  </p>
                </div>
              )}
            </Card>

            {/* Factual Performance & Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-xl">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#617066] uppercase block">Location</span>
                    <span className="text-sm font-bold text-[#29352D]">{provider.location || 'Not Specified'}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#DDE8DC] text-[#9A8FB5] border border-[#C8D7C7] rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#617066] uppercase block">Experience</span>
                    <span className="text-sm font-bold text-[#29352D]">{provider.experience_years} Years</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#DDE8DC] text-[#D6A89A] border border-[#C8D7C7] rounded-xl">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#617066] uppercase block">Completed Cases</span>
                    <span className="text-sm font-bold text-[#29352D]">{provider.completed_requests} Requests</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* WHY THIS PROVIDER MATCHES SECTION */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#C8D7C7]">
                <ShieldCheck className="w-5 h-5 text-[#7C9A82]" />
                <h3 className="text-sm font-bold text-[#29352D] uppercase tracking-wider">
                  Why this provider matches
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="flex items-start gap-3 p-3.5 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7]">
                  <CheckCircle2 className="w-4 h-4 text-[#7C9A82] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#29352D] block">Jurisdiction & Location Match</span>
                    <span className="text-[#617066] text-[11px]">
                      Operates within {provider.location || 'matching location'} jurisdiction.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7]">
                  <CheckCircle2 className="w-4 h-4 text-[#7C9A82] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#29352D] block">Service Compatibility</span>
                    <span className="text-[#617066] text-[11px]">
                      Registered as {provider.provider_type} providing relevant legal assistance.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7]">
                  <CheckCircle2 className="w-4 h-4 text-[#7C9A82] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#29352D] block">Verification Status</span>
                    <span className="text-[#617066] text-[11px]">
                      Status is {provider.verification_status}. Platform verification protocol applied.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7]">
                  <CheckCircle2 className="w-4 h-4 text-[#7C9A82] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#29352D] block">Reliability & Practice Record</span>
                    <span className="text-[#617066] text-[11px]">
                      System reliability score: {provider.reliability_score?.toFixed(1)} / 100.
                    </span>
                  </div>
                </div>
              </div>

              {isAdvocate && (
                <div className="mt-4 pt-3 border-t border-[#C8D7C7] text-[11px] text-[#617066] italic text-center">
                  Factual non-promotional advocate listing. No paid rankings or promotional badges displayed per Bar Council rules.
                </div>
              )}
            </Card>

            {/* Practice Areas & Registration (Generic Fields) */}
            {provider.generic_fields && provider.generic_fields.length > 0 && (
              <Card className="p-6">
                <h3 className="text-xs font-bold text-[#617066] uppercase tracking-wider mb-4 pb-2 border-b border-[#C8D7C7]">
                  Registration & Practice Specifications
                </h3>

                <div className="space-y-3">
                  {provider.generic_fields.map((field, idx) => (
                    field.value ? (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7] text-xs">
                        <span className="font-bold text-[#617066] uppercase text-[11px] tracking-wide">
                          {field.field_label || field.field_name}
                        </span>
                        <span className="text-[#29352D] font-semibold mt-1 sm:mt-0">
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
