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
  Sparkles,
  UserCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { matchingApi, requestsApi } from '../../api';
import {
  MatchResponse,
  MatchedProviderOut,
  ServiceRequest,
  ProviderType,
  VerificationStatus,
  AvailabilityStatus,
} from '../../types';

export const MatchingResultsPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [requestDetails, setRequestDetails] = useState<ServiceRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMatchesAndRequest = async () => {
    if (!requestId || isNaN(Number(requestId))) {
      setErrorMessage('Invalid service request ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const parsedId = Number(requestId);

      // Fetch service request details first
      const reqDetails = await requestsApi.getRequestDetails(parsedId);
      setRequestDetails(reqDetails);

      // Execute backend matching engine
      const matches = await matchingApi.matchProviders(parsedId, 0.0);
      setMatchData(matches);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to calculate provider matches.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndRequest();
  }, [requestId]);

  const renderVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return <Badge variant="success">Verified Provider</Badge>;
      case VerificationStatus.PENDING:
        return <Badge variant="warning">Verification Pending</Badge>;
      case VerificationStatus.REJECTED:
        return <Badge variant="danger">Unverified</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const renderProviderTypeBadge = (type: ProviderType) => {
    switch (type) {
      case ProviderType.ADVOCATE:
        return <Badge variant="primary">Advocate</Badge>;
      case ProviderType.MEDIATOR:
        return <Badge variant="indigo">Mediator</Badge>;
      case ProviderType.ARBITRATOR:
        return <Badge variant="purple">Arbitrator</Badge>;
      case ProviderType.NOTARY:
        return <Badge variant="info">Notary</Badge>;
      case ProviderType.DOCUMENT_WRITER:
        return <Badge variant="neutral">Document Writer</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TOP BAR / BACK NAVIGATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link to="/citizen/dashboard">
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Portal
              </Button>
            </Link>

            <div className="h-5 w-px bg-[#2D3D32]" />

            <div className="flex items-center gap-2 text-xs font-bold text-[#8EA895] uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Matching Engine</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchMatchesAndRequest}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Re-run Matcher
          </Button>
        </div>

        {/* REQUEST CONTEXT HEADER CARD */}
        {requestDetails && (
          <Card className="p-6 mb-8 bg-[#1C261F] border-[#2D3D32]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#8EA895]">Service Request #{requestDetails.id}</span>
                  <span className="text-[#A3B5A7]">•</span>
                  <span className="text-xs font-semibold text-[#E6EFE8]">{requestDetails.service_category}</span>
                  <Badge variant="info">Preferred: {requestDetails.preferred_provider_type}</Badge>
                </div>

                <h1 className="text-xl font-bold text-[#E6EFE8] tracking-tight">
                  {requestDetails.description}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#A3B5A7] pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#8EA895]" /> {requestDetails.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#B3A7CF]" /> Urgency: {requestDetails.urgency}
                  </span>
                  {requestDetails.legal_aid_interest && (
                    <Badge variant="purple" size="sm">Legal Aid Interest Flagged</Badge>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Link to={`/citizen/requests/${requestDetails.id}`}>
                  <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                    View Request Workspace
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* REGULATORY COMPLIANCE BANNER FOR ADVOCATES */}
        <div className="mb-6 p-4 bg-[#1C261F] border border-[#2D3D32] rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-[#233027] border border-[#2D3D32] rounded-xl text-[#8EA895] shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-[#E6EFE8]">
              Legal Council Regulatory Compliance Shield & Factual Matching
            </h4>
            <p className="text-[#A3B5A7] leading-relaxed">
              LexLogic operates strictly under Bar Council regulatory standards. Advocate listings display neutral factual suitability details (practice areas, registration status, experience) without commercial promotional ranking scores. Matching is initiated by the citizen.
            </p>
          </div>
        </div>

        {/* LOADING & ERROR STATES */}
        {isLoading && (
          <div className="py-16">
            <LoadingState message="Executing deterministic multi-attribute matching algorithm..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Matching Calculation Error"
            message={errorMessage}
            onRetry={fetchMatchesAndRequest}
          />
        )}

        {/* EMPTY STATE */}
        {!isLoading && !errorMessage && matchData && matchData.matched_providers.length === 0 && (
          <div className="bg-[#233027] border border-[#2D3D32] rounded-2xl p-12 text-center max-w-xl mx-auto my-8 shadow-sm">
            <div className="inline-flex items-center justify-center p-4 bg-[#1C261F] border border-[#2D3D32] rounded-2xl text-[#E89D9D] mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#E6EFE8]">
              No suitable providers found for this request yet.
            </h3>
            <p className="text-xs text-[#A3B5A7] mt-2 mb-6 leading-relaxed">
              We couldn't find matching verified providers for location "{requestDetails?.location}" or category "{requestDetails?.service_category}". Try modifying your location or submitting a new request.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/citizen/request/new">
                <Button variant="primary" size="md">
                  Modify Request & Try Again
                </Button>
              </Link>
              <Link to="/citizen/dashboard">
                <Button variant="secondary" size="md">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* MATCHED PROVIDERS LIST */}
        {!isLoading && !errorMessage && matchData && matchData.matched_providers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                  Available Matched Providers
                </span>
                <span className="px-2 py-0.5 bg-[#1C261F] text-[#E6EFE8] border border-[#2D3D32] text-xs font-bold rounded-full">
                  {matchData.total_matches}
                </span>
              </div>
              <span className="text-[11px] text-[#A3B5A7] font-medium">
                Matches based on your request and provider suitability
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {matchData.matched_providers.map((provider: MatchedProviderOut) => {
                const isAdvocate = provider.provider_type === ProviderType.ADVOCATE || provider.is_advocate_factual_match;

                return (
                  <Card key={provider.provider_id} className="p-6 flex flex-col justify-between">
                    <div>
                      {/* Top Bar: Provider Type & Advocate Neutral Match Tag */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {renderProviderTypeBadge(provider.provider_type)}
                          {renderVerificationBadge(provider.verification_status)}
                        </div>

                        {/* REGULATORY SHIELD MANDATE FOR ADVOCATE */}
                        {isAdvocate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E6EFE8] bg-[#1C261F] border border-[#2D3D32] px-2.5 py-1 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#8EA895]" /> Citizen-initiated match
                          </span>
                        ) : (
                          provider.match_score !== undefined && provider.match_score !== null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E6EFE8] bg-[#1C261F] border border-[#2D3D32] px-2.5 py-1 rounded-lg">
                              <Sparkles className="w-3.5 h-3.5 text-[#8EA895]" /> {provider.match_score.toFixed(0)}% Match Score
                            </span>
                          )
                        )}
                      </div>

                      {/* Provider Header */}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-[#E6EFE8] flex items-center gap-2">
                          {provider.full_name}
                        </h3>
                        {provider.bio && (
                          <p className="text-xs text-[#A3B5A7] mt-1 line-clamp-2 leading-relaxed">
                            {provider.bio}
                          </p>
                        )}
                      </div>

                      {/* Factual Information Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-[#1C261F] p-3.5 rounded-xl border border-[#2D3D32] mb-4">
                        <div className="flex items-center gap-2 text-[#E6EFE8]">
                          <MapPin className="w-4 h-4 text-[#8EA895] shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#A3B5A7] block uppercase font-bold">Location</span>
                            <span>{provider.location || 'Location Not Specified'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[#E6EFE8]">
                          <Clock className="w-4 h-4 text-[#B3A7CF] shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#A3B5A7] block uppercase font-bold">Experience</span>
                            <span>{provider.experience_years} Years</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[#E6EFE8] col-span-2">
                          <UserCheck className="w-4 h-4 text-[#8EA895] shrink-0" />
                          <div>
                            <span className="text-[10px] text-[#A3B5A7] block uppercase font-bold">Availability</span>
                            <span className="font-semibold text-[#E6EFE8]">
                              {provider.availability_status === AvailabilityStatus.AVAILABLE
                                ? 'Available for engagement'
                                : provider.availability_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* WHY THIS PROVIDER MATCHES SECTION */}
                      <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] mb-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#E6EFE8] uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#8EA895]" /> Factual Match Breakdown
                          </span>
                          <span className="text-[10px] font-extrabold text-[#8EA895] bg-[#233027] px-2 py-0.5 rounded-full border border-[#2D3D32]">
                            Score: {provider.match_score !== undefined && provider.match_score !== null ? `${provider.match_score.toFixed(0)}/100` : '100/100'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#E6EFE8]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895] shrink-0" />
                            <span>Service Match (35%): {requestDetails?.service_category}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895] shrink-0" />
                            <span>Location (25%): {provider.location || 'Jurisdiction compatibility'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895] shrink-0" />
                            <span>Verification (15%): {provider.verification_status}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895] shrink-0" />
                            <span>Reliability (15%): {(provider.reliability_score ?? 100).toFixed(0)}/100</span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:col-span-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8EA895] shrink-0" />
                            <span>Experience (10%): {provider.experience_years} Years Practice</span>
                          </div>
                        </div>

                        {/* NON-COMMERCIAL GUARANTEE BANNER */}
                        <div className="pt-2 border-t border-[#2D3D32] text-[10px] text-[#A3B5A7] font-medium leading-tight">
                          🛡️ <span className="font-bold text-[#E6EFE8]">Factual Matching Guarantee:</span> Provider matching is strictly based on service relevance and factual attributes. Payment or subscription status does not influence matching.
                        </div>
                      </div>

                      {/* Generic Fields (e.g. Practice Area / Registration) */}
                      {provider.generic_fields && provider.generic_fields.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          {provider.generic_fields.map((gf, idx) => (
                            gf.value && (
                              <div key={idx} className="text-xs flex items-start gap-1.5 text-[#A3B5A7]">
                                <span className="font-semibold text-[#E6EFE8] shrink-0">
                                  {gf.field_label || gf.field_name}:
                                </span>
                                <span className="text-[#E6EFE8]">{gf.value}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-[#2D3D32] flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[#A3B5A7] italic">
                        {isAdvocate ? 'Factual non-promotional listing' : 'Verified service partner'}
                      </span>

                      <div className="flex items-center gap-2">
                        <Link to={`/citizen/providers/${provider.provider_id}`}>
                          <Button variant="primary" size="sm" rightIcon={<ArrowLeft className="w-3.5 h-3.5 rotate-180" />}>
                            View Provider Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
