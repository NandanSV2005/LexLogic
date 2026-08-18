import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Upload,
  FolderLock,
  Lock,
  Trash2,
  Download,
  Plus,
  Eye,
  ShieldAlert,
  Key,
  X,
  RefreshCw,
  UserCheck,
  Award,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { requestsApi, documentsApi } from '../../api';
import {
  ServiceRequest,
  RequestStatus,
  InterestedProvider,
  DocumentItem,
  InteractionStatus,
  DocumentSharePermission,
  DocumentVisibility,
  DocumentShareStatus,
} from '../../types';

interface PendingUploadItem {
  id: string;
  file: File;
  title: string;
}

export const RequestDetailsPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [interestedProviders, setInterestedProviders] = useState<InterestedProvider[]>([]);
  const [myDocuments, setMyDocuments] = useState<DocumentItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [isConfirmingCompletion, setIsConfirmingCompletion] = useState<boolean>(false);

  // Multi-Document Upload & Permission State
  const [pendingItems, setPendingItems] = useState<PendingUploadItem[]>([]);
  const [sharePermission, setSharePermission] = useState<DocumentSharePermission>(DocumentSharePermission.VIEW);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Manage Access Modal State
  const [managingDoc, setManagingDoc] = useState<DocumentItem | null>(null);
  const [isRevokingProviderId, setIsRevokingProviderId] = useState<number | null>(null);

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
    if (!requestId) return;
    setActionLoadingId(providerId);
    setErrorMessage(null);

    try {
      await requestsApi.acceptProvider(Number(requestId), providerId);
      setSuccessMessage('Provider interest ACCEPTED! Representation initiated.');
      await fetchRequestDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept provider.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!requestId) return;
    setIsConfirmingCompletion(true);
    setErrorMessage(null);

    try {
      await requestsApi.confirmCompletion(Number(requestId));
      setSuccessMessage('Service completion CONFIRMED! Request is now officially COMPLETED.');
      await fetchRequestDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to confirm service completion.');
    } finally {
      setIsConfirmingCompletion(false);
    }
  };

  // Multi-Document Queue Management
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles = Array.from(e.target.files);
    const newItems: PendingUploadItem[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
    }));

    setPendingItems((prev) => [...prev, ...newItems]);
    setUploadError(null);
    e.target.value = '';
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setPendingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleRemovePendingItem = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBatchUploadAndShare = async (e: React.FormEvent, providerId: number) => {
    e.preventDefault();
    if (pendingItems.length === 0) {
      setUploadError('Please select at least one document to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const uploadedDocs: DocumentItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setUploadProgressMessage(`Uploading file ${i + 1} of ${pendingItems.length}: ${item.title}...`);

      try {
        const doc = await documentsApi.uploadDocument(item.title, item.file);
        uploadedDocs.push(doc);

        await documentsApi.shareDocument(doc.id, providerId, sharePermission);
      } catch (err: any) {
        errors.push(`Failed to upload ${item.file.name}: ${err.message || 'Upload error'}`);
      }
    }

    setIsUploading(false);
    setUploadProgressMessage(null);

    if (uploadedDocs.length > 0) {
      setUploadSuccess(
        `Successfully uploaded and shared ${uploadedDocs.length} document(s) with ${sharePermission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? 'View + Download' : 'View Only'} permission!`
      );
      setPendingItems([]);
      await fetchRequestDetails();
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' | '));
    }
  };

  const handleRevokeShare = async (documentId: number, providerId: number) => {
    setIsRevokingProviderId(providerId);
    try {
      await documentsApi.revokeDocument(documentId, providerId);
      setSuccessMessage('Document access revoked successfully.');
      await fetchRequestDetails();
      if (managingDoc && managingDoc.id === documentId) {
        const updatedDocs = await documentsApi.listMyDocuments();
        const updated = updatedDocs.find((d) => d.id === documentId);
        if (updated) setManagingDoc(updated);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke document access.');
    } finally {
      setIsRevokingProviderId(null);
    }
  };

  const renderSecurityStatusBadge = (doc: DocumentItem) => {
    if (doc.visibility === DocumentVisibility.PRIVATE) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E2E8E2] text-[#3A473E] border border-[#C4D0C4]">
          <Lock className="w-3 h-3 text-[#617066]" /> Private
        </span>
      );
    }

    if (doc.visibility === DocumentVisibility.REVOKED) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4D6D6] text-[#5C1D1D] border border-[#E8B4B4]">
          <ShieldAlert className="w-3 h-3 text-[#5C1D1D]" /> Access Revoked
        </span>
      );
    }

    const hasDownloadShare = doc.shares?.some(
      (s) => s.status === DocumentShareStatus.ACTIVE && s.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD
    );

    if (hasDownloadShare) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#D4E5D4] text-[#1F4724] border border-[#B2D4B2]">
          <Download className="w-3 h-3 text-[#1F4724]" /> Shared — View + Download
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6E2F0] text-[#3D3352] border border-[#CBBFE0]">
        <Eye className="w-3 h-3 text-[#3D3352]" /> Shared — View Only
      </span>
    );
  };

  // 6-step lifecycle progress calculation
  const getLifecycleStepIndex = (status?: RequestStatus): number => {
    if (!status) return 1;
    switch (status) {
      case RequestStatus.OPEN:
        return interestedProviders.length > 0 ? 3 : 1;
      case RequestStatus.MATCHED:
        return 2;
      case RequestStatus.CONTACTED:
        return 3;
      case RequestStatus.IN_PROGRESS:
        return 4;
      case RequestStatus.COMPLETION_REQUESTED:
        return 5;
      case RequestStatus.COMPLETED:
        return 6;
      default:
        return 1;
    }
  };

  const currentStep = getLifecycleStepIndex(request?.status);

  const acceptedProvider = interestedProviders.find((p) => p.interaction_status === InteractionStatus.ACCEPTED);

  return (
    <div className="min-h-screen bg-[#E8F0E6] text-[#29352D] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/citizen/dashboard"
              className="inline-flex items-center text-xs font-semibold text-[#7C9A82] hover:text-[#6B8870] transition-colors mb-2 gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#29352D] tracking-tight">
                Request Details #{requestId}
              </h1>
              {request && (
                <Badge variant={request.status === RequestStatus.COMPLETED ? 'success' : request.status === RequestStatus.COMPLETION_REQUESTED ? 'warning' : 'info'}>
                  {request.status.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequestDetails}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Details
          </Button>
        </div>

        {errorMessage && (
          <ErrorState
            title="Error Loading Request"
            message={errorMessage}
            onRetry={fetchRequestDetails}
          />
        )}

        {successMessage && (
          <div className="p-4 bg-[#D4E5D4] border border-[#B2D4B2] text-[#1F4724] text-xs rounded-xl flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1F4724]" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-[#1F4724] hover:opacity-75">
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching service request & provider responses..." />
          </div>
        )}

        {!isLoading && request && (
          <div className="space-y-8">
            {/* SERVICE LIFECYCLE PROGRESS STEPPER */}
            <Card className="p-6">
              <h3 className="text-xs font-bold text-[#617066] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7C9A82]" /> Service Journey Lifecycle
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                {[
                  { step: 1, label: 'Request Created' },
                  { step: 2, label: 'Providers Matched' },
                  { step: 3, label: 'Interest Received' },
                  { step: 4, label: 'Provider Connected' },
                  { step: 5, label: 'Completion Requested' },
                  { step: 6, label: 'Service Completed' },
                ].map((s) => {
                  const isDone = currentStep > s.step;
                  const isCurrent = currentStep === s.step;
                  return (
                    <div
                      key={s.step}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        isCurrent
                          ? 'bg-[#DDE8DC] border-[#7C9A82] text-[#29352D] font-bold shadow-sm'
                          : isDone
                          ? 'bg-[#D4E5D4] border-[#B2D4B2] text-[#1F4724] font-semibold'
                          : 'bg-[#FAFCF9] border-[#C8D7C7] text-[#617066]'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? 'bg-[#7C9A82] text-white'
                          : isDone
                          ? 'bg-[#1F4724] text-white'
                          : 'bg-[#C8D7C7] text-[#617066]'
                      }`}>
                        {isDone ? '✓' : s.step}
                      </div>
                      <span className="text-[11px] leading-tight">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* COMPLETION REQUESTED CITIZEN CONFIRMATION BANNER */}
            {request.status === RequestStatus.COMPLETION_REQUESTED && (
              <div className="p-6 bg-[#F5E6CC] border border-[#E6CE9F] rounded-2xl shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-[#5C4114] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-extrabold text-[#5C4114]">
                        Provider has marked this service as COMPLETED
                      </h3>
                      <p className="text-xs text-[#5C4114] mt-1 leading-relaxed">
                        {acceptedProvider
                          ? `${acceptedProvider.full_name} (${acceptedProvider.provider_type}) has submitted completion for your service request.`
                          : 'Your assigned provider has marked work completed on this request.'}{' '}
                        Please review the completed work and confirm below to close this request and award provider incentive points.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    isLoading={isConfirmingCompletion}
                    onClick={handleConfirmCompletion}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    className="shrink-0"
                  >
                    Confirm Completion
                  </Button>
                </div>
              </div>
            )}

            {/* COMPLETED BANNER */}
            {request.status === RequestStatus.COMPLETED && (
              <div className="p-6 bg-[#D4E5D4] border border-[#B2D4B2] text-[#1F4724] rounded-2xl shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-[#1F4724] shrink-0" />
                  <div>
                    <h3 className="text-base font-extrabold text-[#1F4724]">Service Successfully Completed</h3>
                    <p className="text-xs text-[#1F4724] mt-0.5">
                      This service request has been fully resolved and confirmed.
                    </p>
                  </div>
                </div>
                <Badge variant="success">Resolved & Closed</Badge>
              </div>
            )}

            {/* Interested Providers / Connected Provider Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#29352D] tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#7C9A82]" /> Interested Legal Providers ({interestedProviders.length})
                  </h2>
                  <p className="text-xs text-[#617066]">
                    Providers who have expressed interest in assisting your legal need.
                  </p>
                </div>
              </div>

              {interestedProviders.length === 0 ? (
                <Card className="p-8 text-center bg-[#F0F4EC]">
                  <Clock className="w-8 h-8 text-[#617066] mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-[#29352D]">No Providers Have Expressed Interest Yet</h3>
                  <p className="text-xs text-[#617066] mt-1">
                    Verified providers in your category are reviewing open requests. Check back soon.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {interestedProviders.map((prov) => {
                    const isAccepted = prov.interaction_status === InteractionStatus.ACCEPTED;
                    const isDeclined = prov.interaction_status === InteractionStatus.DECLINED;

                    return (
                      <Card
                        key={prov.provider_id}
                        className={`p-6 transition-all ${
                          isAccepted ? 'ring-2 ring-[#7C9A82]' : isDeclined ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="text-base font-extrabold text-[#29352D]">{prov.full_name}</h3>
                              <Badge variant="purple">{prov.provider_type}</Badge>
                              {prov.verification_status === 'VERIFIED' && (
                                <Badge variant="success">Verified Provider</Badge>
                              )}
                              {isAccepted && (
                                <Badge variant="info">
                                  ✓ Representation Active
                                </Badge>
                              )}
                              {isDeclined && (
                                <Badge variant="neutral">Declined</Badge>
                              )}
                            </div>

                            <p className="text-xs text-[#617066] max-w-2xl line-clamp-2 leading-relaxed">
                              {prov.bio || 'Experienced legal provider dedicated to achieving optimal outcomes.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-[#617066] pt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#7C9A82] shrink-0" /> {prov.location || 'Location upon request'}
                              </span>
                              <span>Experience: {prov.experience_years} years</span>
                              <span>Reliability Score: <strong className="text-[#29352D]">{prov.reliability_score.toFixed(1)}/100</strong></span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                            {prov.interaction_status === InteractionStatus.PENDING || prov.interaction_status === InteractionStatus.CONTACTED ? (
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={actionLoadingId === prov.provider_id}
                                onClick={() => handleAcceptProvider(prov.provider_id)}
                                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                              >
                                Accept & Engage Provider
                              </Button>
                            ) : prov.interaction_status === InteractionStatus.ACCEPTED ? (
                              <div className="p-3 bg-[#D4E5D4] border border-[#B2D4B2] rounded-xl text-[#1F4724] text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#1F4724]" /> Active Representation
                              </div>
                            ) : (
                              <span className="text-xs text-[#617066] font-semibold italic">Not Selected</span>
                            )}
                          </div>
                        </div>

                        {/* REQUESTED DOCUMENTS & DOCUMENT ATTACHMENT TAB */}
                        {isAccepted && (
                          <div className="pt-4 border-t border-[#C8D7C7] space-y-4">
                            <div className="p-4 bg-[#DDE8DC] border border-[#C8D7C7] rounded-xl space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FolderLock className="w-4 h-4 text-[#7C9A82]" />
                                  <span className="text-xs font-bold text-[#29352D] uppercase tracking-wider">
                                    Provider Requested Documents
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#7C9A82] font-semibold">
                                  Explicit Authorization Required
                                </span>
                              </div>

                              <p className="text-xs text-[#29352D] leading-relaxed">
                                {prov.requested_documents
                                  ? `Requested documents: "${prov.requested_documents}"`
                                  : 'Provider has not specified custom documents yet. Upload and share your case documents below.'}
                              </p>
                            </div>

                            {/* UPLOAD & SHARE FORM WITH PERMISSION CONTROL */}
                            <form
                              onSubmit={(e) => handleBatchUploadAndShare(e, prov.provider_id)}
                              className="p-4 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl space-y-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#29352D] uppercase tracking-wider flex items-center gap-1.5">
                                  <Upload className="w-4 h-4 text-[#7C9A82]" /> Attach Case Documents for {prov.full_name}
                                </span>
                              </div>

                              {/* PERMISSION SELECTOR: VIEW ONLY vs VIEW + DOWNLOAD */}
                              <div className="p-3.5 bg-[#F0F4EC] border border-[#C8D7C7] rounded-xl space-y-2">
                                <label className="text-xs font-bold text-[#29352D] uppercase tracking-wide block">
                                  Select Explicit Permission Level:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  <label
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                                      sharePermission === DocumentSharePermission.VIEW
                                        ? 'bg-[#DDE8DC] border-[#7C9A82] text-[#29352D] font-bold'
                                        : 'bg-[#FAFCF9] border-[#C8D7C7] text-[#617066] hover:border-[#7C9A82]'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="share_permission"
                                      value={DocumentSharePermission.VIEW}
                                      checked={sharePermission === DocumentSharePermission.VIEW}
                                      onChange={() => setSharePermission(DocumentSharePermission.VIEW)}
                                      className="mt-0.5 text-[#7C9A82] focus:ring-[#7C9A82]"
                                    />
                                    <div>
                                      <span className="block text-[#29352D] font-bold">👁 View Only (Default)</span>
                                      <span className="text-[11px] text-[#617066] font-normal">
                                        Provider can stream and view document in-browser. File downloading is strictly blocked.
                                      </span>
                                    </div>
                                  </label>

                                  <label
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                                      sharePermission === DocumentSharePermission.VIEW_AND_DOWNLOAD
                                        ? 'bg-[#D4E5D4] border-[#B2D4B2] text-[#1F4724] font-bold'
                                        : 'bg-[#FAFCF9] border-[#C8D7C7] text-[#617066] hover:border-[#B2D4B2]'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="share_permission"
                                      value={DocumentSharePermission.VIEW_AND_DOWNLOAD}
                                      checked={sharePermission === DocumentSharePermission.VIEW_AND_DOWNLOAD}
                                      onChange={() => setSharePermission(DocumentSharePermission.VIEW_AND_DOWNLOAD)}
                                      className="mt-0.5 text-[#1F4724] focus:ring-[#1F4724]"
                                    />
                                    <div>
                                      <span className="block text-[#29352D] font-bold">⬇ View + Download Allowed</span>
                                      <span className="text-[11px] text-[#617066] font-normal">
                                        Provider can view in-browser AND download original file attachment to disk.
                                      </span>
                                    </div>
                                  </label>
                                </div>
                              </div>

                              {uploadError && (
                                <div className="p-3 bg-[#F4D6D6] border border-[#E8B4B4] text-[#5C1D1D] text-xs rounded-xl">
                                  {uploadError}
                                </div>
                              )}

                              {uploadSuccess && (
                                <div className="p-3 bg-[#D4E5D4] border border-[#B2D4B2] text-[#1F4724] text-xs rounded-xl font-semibold">
                                  {uploadSuccess}
                                </div>
                              )}

                              {uploadProgressMessage && (
                                <div className="p-3 bg-[#DDE8DC] border border-[#C8D7C7] text-[#29352D] text-xs rounded-xl flex items-center gap-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>{uploadProgressMessage}</span>
                                </div>
                              )}

                              {/* DROPZONE / FILE PICKER */}
                              <div className="border-2 border-dashed border-[#C8D7C7] hover:border-[#7C9A82] rounded-xl p-4 text-center transition-colors">
                                <label className="cursor-pointer block">
                                  <Plus className="w-6 h-6 text-[#7C9A82] mx-auto mb-1" />
                                  <span className="text-xs font-bold text-[#29352D]">
                                    Click to Select Documents
                                  </span>
                                  <span className="text-[10px] text-[#617066] block mt-0.5">
                                    Supports PDF, JPG, PNG (Select multiple files at once)
                                  </span>
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              {/* PENDING FILES QUEUE LIST */}
                              {pendingItems.length > 0 && (
                                <div className="space-y-3 pt-2">
                                  <span className="text-xs font-bold text-[#617066] uppercase tracking-wider block">
                                    Selected Files Queue ({pendingItems.length})
                                  </span>

                                  <div className="space-y-2">
                                    {pendingItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="p-3 bg-[#F0F4EC] border border-[#C8D7C7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <FileText className="w-5 h-5 text-[#7C9A82] shrink-0" />
                                          <div className="flex-1 space-y-1">
                                            <input
                                              type="text"
                                              value={item.title}
                                              onChange={(e) => handleTitleChange(item.id, e.target.value)}
                                              placeholder="Document title..."
                                              className="w-full bg-[#FAFCF9] border border-[#C8D7C7] rounded-lg px-2.5 py-1 text-[#29352D] text-xs focus:outline-none focus:ring-1 focus:ring-[#7C9A82]"
                                            />
                                            <span className="text-[10px] text-[#617066] block truncate">
                                              File: {item.file.name} ({(item.file.size / 1024).toFixed(1)} KB)
                                            </span>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleRemovePendingItem(item.id)}
                                          className="text-[#617066] hover:text-[#5C1D1D] p-1 self-end sm:self-center transition-colors"
                                          title="Remove File"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-[#C8D7C7]">
                                    <span className="text-[11px] text-[#617066]">
                                      Files will be stored securely and shared with permission level: <strong>{sharePermission}</strong>.
                                    </span>

                                    <Button
                                      type="submit"
                                      variant="primary"
                                      size="sm"
                                      isLoading={isUploading}
                                      leftIcon={<Upload className="w-4 h-4" />}
                                    >
                                      Upload & Share {pendingItems.length} Document(s)
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </form>

                            {/* CURRENTLY ATTACHED / SHARED DOCUMENTS VAULT */}
                            {myDocuments.length > 0 && (
                              <div className="pt-2 space-y-3">
                                <span className="text-xs font-bold text-[#617066] uppercase tracking-wider block">
                                  Your Vault Documents & Access Security Status ({myDocuments.length})
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {myDocuments.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <FileText className="w-4 h-4 text-[#7C9A82] shrink-0" />
                                        <div className="truncate">
                                          <span className="font-bold text-[#29352D] block truncate">
                                            {doc.title}
                                          </span>
                                          <div className="mt-1">
                                            {renderSecurityStatusBadge(doc)}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setManagingDoc(doc)}
                                          className="p-1.5 bg-[#F0F4EC] hover:bg-[#DDE8DC] text-[#29352D] rounded-lg border border-[#C8D7C7] transition-colors"
                                          title="Manage Access & Permissions"
                                        >
                                          <Key className="w-3.5 h-3.5" />
                                        </button>

                                        <a
                                          href={documentsApi.getDocumentDownloadUrl(doc.id)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 bg-[#F0F4EC] hover:bg-[#DDE8DC] text-[#7C9A82] rounded-lg border border-[#C8D7C7] transition-colors"
                                          title="Download File"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed Parameters Card */}
            <Card className="p-6">
              <div>
                <h2 className="text-xs font-bold text-[#617066] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#7C9A82]" /> Description of Legal Problem
                </h2>
                <p className="text-xs sm:text-sm text-[#29352D] leading-relaxed bg-[#FAFCF9] p-4 rounded-xl border border-[#C8D7C7] whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mt-6">
                <div className="bg-[#FAFCF9] p-3.5 rounded-xl border border-[#C8D7C7]">
                  <span className="text-[10px] font-bold text-[#617066] uppercase block mb-1">
                    Location
                  </span>
                  <span className="text-[#29352D] font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#7C9A82]" /> {request.location}
                  </span>
                </div>

                <div className="bg-[#FAFCF9] p-3.5 rounded-xl border border-[#C8D7C7]">
                  <span className="text-[10px] font-bold text-[#617066] uppercase block mb-1">
                    Preferred Provider Type
                  </span>
                  <span className="text-[#29352D] font-bold">
                    {request.preferred_provider_type}
                  </span>
                </div>

                <div className="bg-[#FAFCF9] p-3.5 rounded-xl border border-[#C8D7C7]">
                  <span className="text-[10px] font-bold text-[#617066] uppercase block mb-1">
                    Urgency Level
                  </span>
                  <span className="text-[#29352D] font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#9A8FB5]" /> {request.urgency}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* MANAGE ACCESS MODAL */}
      {managingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#29352D]/50 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#C8D7C7] pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#7C9A82]" />
                <h3 className="text-base font-bold text-[#29352D]">
                  Manage Access — {managingDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setManagingDoc(null)}
                className="text-[#617066] hover:text-[#29352D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl">
                <div>
                  <span className="text-[#29352D] font-bold block">Document Title: {managingDoc.title}</span>
                  <span className="text-[#617066] text-[11px] block">Filename: {managingDoc.filename}</span>
                </div>
                <div>{renderSecurityStatusBadge(managingDoc)}</div>
              </div>

              <h4 className="font-bold text-[#29352D] uppercase tracking-wider text-[11px] pt-1">
                Active & Revoked Share Grants
              </h4>

              {(!managingDoc.shares || managingDoc.shares.length === 0) ? (
                <p className="text-[#617066] text-xs italic p-3 bg-[#FAFCF9] rounded-xl border border-[#C8D7C7]">
                  This document is currently PRIVATE to you. No providers have been granted access.
                </p>
              ) : (
                <div className="space-y-2">
                  {managingDoc.shares.map((share) => (
                    <div
                      key={share.id}
                      className="p-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-[#29352D] block">
                          Provider ID #{share.shared_with_provider_id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            share.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD
                              ? 'bg-[#D4E5D4] text-[#1F4724]'
                              : 'bg-[#E6E2F0] text-[#3D3352]'
                          }`}>
                            {share.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? 'View + Download' : 'View Only'}
                          </span>
                          <span className="text-[#617066] text-[10px]">
                            Status: {share.status}
                          </span>
                        </div>
                      </div>

                      {share.status === DocumentShareStatus.ACTIVE ? (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={isRevokingProviderId === share.shared_with_provider_id}
                          onClick={() => handleRevokeShare(managingDoc.id, share.shared_with_provider_id)}
                        >
                          Revoke Access
                        </Button>
                      ) : (
                        <span className="text-[#617066] text-[11px] font-semibold">Access Revoked</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#C8D7C7]">
              <Button variant="outline" size="sm" onClick={() => setManagingDoc(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
