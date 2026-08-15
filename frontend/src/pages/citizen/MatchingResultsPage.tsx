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
  Building2,
  FileText,
  ExternalLink,
  RefreshCw,
  Info,
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
      const status = err?.status;
      if (status === 404) {
        setErrorMessage('Service request not found or does not exist.');
      } else if (status === 403) {
        setErrorMessage('You do not have permission to view matching results for this request.');
      } else {
        setErrorMessage(err.message || 'Failed to fetch matched providers. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndRequest();
  }, [requestId]);

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

  const renderVerificationBadge = (status: VerificationStatus) => {
    if (status === VerificationStatus.VERIFIED) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5" /> Verified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
        <Clock className="w-3.5 h-3.5" /> Verification Pending
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Link
              to="/citizen/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Citizen Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Providers matched to your request
              </h1>
              {requestDetails && (
                <Badge variant="neutral">Request #{requestDetails.id}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMatchesAndRequest}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Matches
            </Button>
            <Link to="/citizen/request/new">
              <Button variant="primary" size="sm">
                New Request
              </Button>
            </Link>
          </div>
        </div>

        {/* DISTINCTIVE REQUEST SUMMARY HEADER BOX */}
        {requestDetails && (
          <div className="mb-8 p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/20">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Your Request Summary
                </span>
                <span className="text-xs font-bold text-slate-200">{requestDetails.service_category}</span>
                <span className="text-slate-600">•</span>
                <span className="text-xs font-semibold text-slate-300">
                  Location: <span className="text-emerald-400">{requestDetails.location}</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                "{requestDetails.description}"
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to={`/citizen/requests/${requestDetails.id}`}>
                <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                  View Request Details
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center">
            <LoadingState message="Finding suitable legal service providers..." />
            <p className="text-xs text-slate-500 mt-2">
              Evaluating provider location, experience, availability, and verification records...
            </p>
          </div>
        )}

        {/* ERROR STATE */}
        {errorMessage && !isLoading && (
          <ErrorState
            title="Unable to Load Matches"
            message={errorMessage}
            onRetry={fetchMatchesAndRequest}
            className="my-8 max-w-2xl mx-auto"
          />
        )}

        {/* EMPTY STATE */}
        {!isLoading && !errorMessage && matchData && matchData.matched_providers.length === 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-8 shadow-xl">
            <div className="inline-flex items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-2xl text-amber-400 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">
              No suitable providers found for this request yet.
            </h3>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
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
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Available Matched Providers
                </span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-full">
                  {matchData.total_matches}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Matches based on your request and provider suitability
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {matchData.matched_providers.map((provider: MatchedProviderOut) => {
                const isAdvocate = provider.provider_type === ProviderType.ADVOCATE || provider.is_advocate_factual_match;

                return (
                  <Card key={provider.provider_id} className="p-6 border-slate-800 bg-slate-900/90 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all">
                    <div>
                      {/* Top Bar: Provider Type & Advocate Neutral Match Tag */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {renderProviderTypeBadge(provider.provider_type)}
                          {renderVerificationBadge(provider.verification_status)}
                        </div>

                        {/* REGULATORY SHIELD MANDATE FOR ADVOCATE */}
                        {isAdvocate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Citizen-initiated match
                          </span>
                        ) : (
                          provider.match_score !== undefined && provider.match_score !== null && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                              <Sparkles className="w-3.5 h-3.5" /> {provider.match_score.toFixed(0)}% Match Score
                            </span>
                          )
                        )}
                      </div>

                      {/* Provider Header */}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                          {provider.full_name}
                        </h3>
                        {provider.bio && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {provider.bio}
                          </p>
                        )}
                      </div>

                      {/* Factual Information Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 mb-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Location</span>
                            <span>{provider.location || 'Location Not Specified'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-300">
                          <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Experience</span>
                            <span>{provider.experience_years} Years</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-300 col-span-2">
                          <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Availability</span>
                            <span className="font-medium text-slate-200">
                              {provider.availability_status === AvailabilityStatus.AVAILABLE
                                ? 'Available for engagement'
                                : provider.availability_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* WHY THIS PROVIDER MATCHES SECTION */}
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 mb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Why this provider matches
                        </span>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>Location: {provider.location || 'Jurisdiction compatibility'}</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                            <span>Service: Registered {provider.provider_type}</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            <span>Verification: {provider.verification_status} status</span>
                          </li>
                        </ul>
                      </div>

                      {/* Generic Fields (e.g. Practice Area / Registration) */}
                      {provider.generic_fields && provider.generic_fields.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          {provider.generic_fields.map((gf, idx) => (
                            gf.value && (
                              <div key={idx} className="text-xs flex items-start gap-1.5 text-slate-400">
                                <span className="font-semibold text-slate-300 shrink-0">
                                  {gf.field_label || gf.field_name}:
                                </span>
                                <span className="text-slate-200">{gf.value}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500 italic">
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
