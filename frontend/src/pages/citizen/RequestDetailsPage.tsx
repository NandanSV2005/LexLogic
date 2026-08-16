import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Scale,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  FileText,
  ShieldCheck,
  UserCheck,
  Phone,
  Upload,
  Share2,
  FolderLock,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { requestsApi, documentsApi } from '../../api';
import {
  ServiceRequest,
  RequestStatus,
  InterestedProvider,
  DocumentItem,
  InteractionStatus,
} from '../../types';

export const RequestDetailsPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [interestedProviders, setInterestedProviders] = useState<InterestedProvider[]>([]);
  const [myDocuments, setMyDocuments] = useState<DocumentItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Document Upload State
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fetchRequestDetails = async () => {
    if (!requestId || isNaN(Number(requestId))) {
      setErrorMessage('Invalid request ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [reqData, providersData, docsData] = await Promise.all([
        requestsApi.getRequestDetails(Number(requestId)),
        requestsApi.getInterestedProviders(Number(requestId)).catch(() => []),
        documentsApi.listMyDocuments().catch(() => []),
      ]);

      setRequest(reqData);
      setInterestedProviders(providersData);
      setMyDocuments(docsData);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        setErrorMessage('Service request not found.');
      } else if (status === 403) {
        setErrorMessage('You do not have permission to view this service request.');
      } else {
        setErrorMessage(err.message || 'Failed to load service request details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const handleAcceptProvider = async (providerId: number) => {
    if (!request) return;
    setActionLoadingId(providerId);
    setErrorMessage(null);

    try {
      const updatedReq = await requestsApi.acceptProvider(request.id, providerId);
      setRequest(updatedReq);
      setSuccessMessage('Advocate accepted! Case is now active and in progress.');
      await fetchRequestDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept provider.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUploadAndShare = async (e: React.FormEvent, providerId: number) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setErrorMessage('Please select a file and enter a document title.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // 1. Upload Document
      const newDoc = await documentsApi.uploadDocument(uploadTitle.trim(), uploadFile);


      // 2. Share with Advocate Provider
      await documentsApi.shareDocument(newDoc.id, providerId);

      setSuccessMessage(`Document "${newDoc.title}" uploaded and shared with Advocate successfully!`);
      setUploadTitle('');
      setUploadFile(null);
      await fetchRequestDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload and share document.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.OPEN:
        return <Badge variant="info">Open Request</Badge>;
      case RequestStatus.MATCHED:
        return <Badge variant="purple">Providers Matched</Badge>;
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

  const statusSteps: Array<{ key: RequestStatus; label: string }> = [
    { key: RequestStatus.OPEN, label: 'Open' },
    { key: RequestStatus.MATCHED, label: 'Matched' },
    { key: RequestStatus.CONTACTED, label: 'Contacted' },
    { key: RequestStatus.IN_PROGRESS, label: 'In Progress' },
    { key: RequestStatus.COMPLETED, label: 'Completed' },
  ];

  const getStepState = (stepKey: RequestStatus, currentStatus: RequestStatus) => {
    if (currentStatus === RequestStatus.CANCELLED) return 'cancelled';
    const order = [
      RequestStatus.OPEN,
      RequestStatus.MATCHED,
      RequestStatus.CONTACTED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.COMPLETED,
    ];
    const currentIndex = order.indexOf(currentStatus);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  // Find assigned / accepted provider if any
  const acceptedProvider = interestedProviders.find((p) => p.interaction_status === InteractionStatus.ACCEPTED);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          to="/citizen/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Citizen Dashboard
        </Link>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Loading service request details..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Access Error"
            message={errorMessage}
            onRetry={fetchRequestDetails}
            className="my-4"
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

        {!isLoading && request && (
          <div className="space-y-6">
            {/* Header Title Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      Service Request #{request.id}
                    </span>
                    {renderStatusBadge(request.status)}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
                    {request.service_category}
                  </h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/citizen/matches/${request.id}`}>
                    <Button variant="primary" size="md" rightIcon={<Sparkles className="w-4 h-4" />}>
                      View Matched Providers
                    </Button>
                  </Link>
                </div>
              </div>

              {/* PROGRESS STEPPER */}
              <div className="pt-6">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-4">
                  Request Lifecycle Progression
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {statusSteps.map((step) => {
                    const state = getStepState(step.key, request.status);
                    return (
                      <div
                        key={step.key}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-xs transition-all ${
                          state === 'completed'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : state === 'current'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-bold ring-1 ring-indigo-500/40'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {state === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : state === 'current' ? (
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 bg-slate-900" />
                        )}
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* INTERESTED ADVOCATES / PROVIDERS SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                    Advocates Interested in Your Case ({interestedProviders.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Advocates who have expressed interest in assisting with your legal requirement.
                  </p>
                </div>
              </div>

              {interestedProviders.length === 0 ? (
                <Card className="p-6 border-slate-800 bg-slate-900/90 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-200">Awaiting Advocate Interest</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    No advocates have expressed interest yet. Your request is visible in the eligible feed for matching advocates.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {interestedProviders.map((prov) => {
                    const isAccepted = prov.interaction_status === InteractionStatus.ACCEPTED;

                    return (
                      <Card
                        key={prov.provider_id}
                        className={`p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4 transition-all ${
                          isAccepted ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-lg">
                              {prov.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-100">{prov.full_name}</h3>
                                <Badge variant="purple">{prov.provider_type}</Badge>
                                {prov.verification_status === 'VERIFIED' && (
                                  <Badge variant="success">Verified</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {prov.experience_years} Years Experience • {prov.location || 'Location Not Specified'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAccepted ? (
                              <Badge variant="success">Assigned Advocate (Active Case)</Badge>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={actionLoadingId === prov.provider_id}
                                onClick={() => handleAcceptProvider(prov.provider_id)}
                                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                              >
                                Accept Advocate
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* ADVOCATE ACCEPTED BANNER */}
                        {isAccepted && (
                          <div className="p-4 bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/30 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                              <CheckCircle2 className="w-5 h-5 shrink-0" />
                              <span>{prov.full_name} has agreed to assist with your case!</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              You have accepted {prov.full_name} for this service request. You can now communicate directly and upload required documents below.
                            </p>
                            {prov.phone && (
                              <div className="pt-1 flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                                <Phone className="w-4 h-4 text-emerald-400" />
                                <span>Contact Number: {prov.phone}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* REQUESTED DOCUMENTS CHECKLIST BANNER */}
                        {prov.requested_documents && (
                          <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wide">
                              <FileText className="w-4 h-4 text-indigo-400" />
                              <span>Documents Requested by Advocate ({prov.full_name}):</span>
                            </div>
                            <p className="text-xs text-slate-200 font-medium bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed whitespace-pre-wrap">
                              "{prov.requested_documents}"
                            </p>
                          </div>
                        )}

                        {/* DOCUMENT UPLOAD & SHARE WORKSPACE FOR ACCEPTED ADVOCATE */}
                        {isAccepted && (
                          <div className="pt-4 border-t border-slate-800 space-y-4">
                            <div className="flex items-center gap-2">
                              <FolderLock className="w-5 h-5 text-emerald-400" />
                              <h4 className="text-sm font-bold text-slate-100">
                                Upload & Attach Required Documents
                              </h4>
                            </div>

                            <form
                              onSubmit={(e) => handleUploadAndShare(e, prov.provider_id)}
                              className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                  label="Document Title"
                                  type="text"
                                  placeholder="e.g. Property Title Deed / Sale Agreement"
                                  value={uploadTitle}
                                  onChange={(e) => setUploadTitle(e.target.value)}
                                  required
                                  leftIcon={<FileText className="w-4 h-4 text-indigo-400" />}
                                />

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                                    Select File (PDF / Image)
                                  </label>
                                  <input
                                    type="file"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    required
                                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <span className="text-[11px] text-slate-400">
                                  Files uploaded here are encrypted and automatically shared with {prov.full_name}.
                                </span>

                                <Button
                                  type="submit"
                                  variant="primary"
                                  size="sm"
                                  isLoading={isUploading}
                                  leftIcon={<Upload className="w-4 h-4" />}
                                >
                                  Upload & Share Document
                                </Button>
                              </div>
                            </form>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed Parameters Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-6">
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" /> Description of Legal Problem
                </h2>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80 whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Location
                  </span>
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {request.location}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Preferred Provider Type
                  </span>
                  <span className="text-slate-200 font-medium">
                    {request.preferred_provider_type}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Urgency Level
                  </span>
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> {request.urgency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-800">
                <div>
                  <span className="text-slate-400">Legal Aid Interest: </span>
                  <span className="font-semibold text-slate-200">
                    {request.legal_aid_interest ? 'Yes (Flagged for Legal Aid routing)' : 'No'}
                  </span>
                </div>

                <div className="sm:text-right">
                  <span className="text-slate-400">Created At: </span>
                  <span className="text-slate-300">
                    {new Date(request.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
