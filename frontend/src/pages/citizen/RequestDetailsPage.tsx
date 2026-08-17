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
  Trash2,
  Download,
  Plus,
  Eye,
  ShieldAlert,
  Key,
  X,
  RefreshCw,
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

  const handleDeclineProvider = async (providerId: number) => {
    if (!requestId) return;
    setActionLoadingId(providerId);
    setErrorMessage(null);

    try {
      await requestsApi.acceptProvider(Number(requestId), providerId);
      setSuccessMessage('Provider updated.');
      await fetchRequestDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update provider.');
    } finally {
      setActionLoadingId(null);
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          <Lock className="w-3 h-3 text-slate-400" /> Private
        </span>
      );
    }

    if (doc.visibility === DocumentVisibility.REVOKED) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
          <ShieldAlert className="w-3 h-3 text-rose-400" /> Access Revoked
        </span>
      );
    }

    const hasDownloadShare = doc.shares?.some(
      (s) => s.status === DocumentShareStatus.ACTIVE && s.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD
    );

    if (hasDownloadShare) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          <Download className="w-3 h-3 text-emerald-400" /> Shared — View + Download
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
        <Eye className="w-3 h-3 text-indigo-400" /> Shared — View Only
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/citizen/dashboard"
              className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-2 gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Request Details #{requestId}
              </h1>
              {request && (
                <Badge variant={request.status === RequestStatus.COMPLETED ? 'success' : 'info'}>
                  {request.status}
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
            <LoadingState message="Fetching service request & provider responses..." />
          </div>
        )}

        {!isLoading && request && (
          <div className="space-y-8">
            {/* Interested Providers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-400" /> Interested Legal Providers ({interestedProviders.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Providers who have expressed interest in fighting your case or assisting your legal need.
                  </p>
                </div>
              </div>

              {interestedProviders.length === 0 ? (
                <Card className="p-8 text-center border-slate-800 bg-slate-900/50">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">No Providers Have Expressed Interest Yet</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Verified providers in your category are reviewing open requests. Check back soon.
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
                          isAccepted ? 'ring-2 ring-emerald-500/50 bg-slate-900' : ''
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h3 className="text-base font-bold text-slate-100">{prov.full_name}</h3>
                              <Badge variant="purple">{prov.provider_type}</Badge>
                              {prov.verification_status === 'VERIFIED' && (
                                <Badge variant="success">Verified Provider</Badge>
                              )}
                              {isAccepted && (
                                <Badge variant="info" className="animate-pulse">
                                  ✓ Agreed to Fight For You
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 max-w-2xl line-clamp-2">
                              {prov.bio || 'Experienced legal provider dedicated to achieving optimal outcomes.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {prov.location || 'Location upon request'}
                              </span>
                              <span>Experience: {prov.experience_years} years</span>
                              <span>Reliability Score: <strong className="text-purple-300">{prov.reliability_score.toFixed(1)}/100</strong></span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                            {prov.interaction_status === InteractionStatus.PENDING ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  isLoading={actionLoadingId === prov.provider_id}
                                  onClick={() => handleDeclineProvider(prov.provider_id)}
                                >
                                  Decline
                                </Button>

                                <Button
                                  variant="primary"
                                  size="sm"
                                  isLoading={actionLoadingId === prov.provider_id}
                                  onClick={() => handleAcceptProvider(prov.provider_id)}
                                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                                >
                                  Accept & Engage Provider
                                </Button>
                              </>
                            ) : prov.interaction_status === InteractionStatus.ACCEPTED ? (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Active Service Representation
                              </div>
                            ) : (
                              <Badge variant="neutral">Declined</Badge>
                            )}
                          </div>
                        </div>

                        {/* REQUESTED DOCUMENTS & DOCUMENT ATTACHMENT TAB */}
                        {isAccepted && (
                          <div className="pt-4 border-t border-slate-800 space-y-4">
                            <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FolderLock className="w-4 h-4 text-indigo-400" />
                                  <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                                    Provider Requested Documents
                                  </span>
                                </div>
                                <span className="text-[11px] text-indigo-300 font-medium">
                                  Explicit Authorization Required
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 leading-relaxed">
                                {prov.requested_documents
                                  ? `Requested documents: "${prov.requested_documents}"`
                                  : 'Provider has not specified custom documents yet. Upload and share your case documents below.'}
                              </p>
                            </div>

                            {/* UPLOAD & SHARE FORM WITH PERMISSION CONTROL */}
                            <form
                              onSubmit={(e) => handleBatchUploadAndShare(e, prov.provider_id)}
                              className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <Upload className="w-4 h-4 text-indigo-400" /> Attach Case Documents for {prov.full_name}
                                </span>
                              </div>

                              {/* PERMISSION SELECTOR: VIEW ONLY vs VIEW + DOWNLOAD */}
                              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block">
                                  Select Explicit Permission Level:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  <label
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                                      sharePermission === DocumentSharePermission.VIEW
                                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 font-semibold'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="share_permission"
                                      value={DocumentSharePermission.VIEW}
                                      checked={sharePermission === DocumentSharePermission.VIEW}
                                      onChange={() => setSharePermission(DocumentSharePermission.VIEW)}
                                      className="mt-0.5 text-indigo-500 focus:ring-indigo-500"
                                    />
                                    <div>
                                      <span className="block text-slate-100 font-medium">👁 View Only (Default)</span>
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        Provider can stream and view document in-browser. File downloading is strictly blocked.
                                      </span>
                                    </div>
                                  </label>

                                  <label
                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                                      sharePermission === DocumentSharePermission.VIEW_AND_DOWNLOAD
                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-semibold'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="share_permission"
                                      value={DocumentSharePermission.VIEW_AND_DOWNLOAD}
                                      checked={sharePermission === DocumentSharePermission.VIEW_AND_DOWNLOAD}
                                      onChange={() => setSharePermission(DocumentSharePermission.VIEW_AND_DOWNLOAD)}
                                      className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <div>
                                      <span className="block text-slate-100 font-medium">⬇ View + Download Allowed</span>
                                      <span className="text-[11px] text-slate-400 font-normal">
                                        Provider can view in-browser AND download original file attachment to disk.
                                      </span>
                                    </div>
                                  </label>
                                </div>
                              </div>

                              {uploadError && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
                                  {uploadError}
                                </div>
                              )}

                              {uploadSuccess && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl">
                                  {uploadSuccess}
                                </div>
                              )}

                              {uploadProgressMessage && (
                                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-xl flex items-center gap-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>{uploadProgressMessage}</span>
                                </div>
                              )}

                              {/* DROPZONE / FILE PICKER */}
                              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 text-center transition-colors">
                                <label className="cursor-pointer block">
                                  <Plus className="w-6 h-6 text-indigo-400 mx-auto mb-1" />
                                  <span className="text-xs font-semibold text-slate-200">
                                    Click to Select Documents
                                  </span>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
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
                                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                                    Selected Files Queue ({pendingItems.length})
                                  </span>

                                  <div className="space-y-2">
                                    {pendingItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                                          <div className="flex-1 space-y-1">
                                            <input
                                              type="text"
                                              value={item.title}
                                              onChange={(e) => handleTitleChange(item.id, e.target.value)}
                                              placeholder="Document title..."
                                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <span className="text-[10px] text-slate-500 block truncate">
                                              File: {item.file.name} ({(item.file.size / 1024).toFixed(1)} KB)
                                            </span>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleRemovePendingItem(item.id)}
                                          className="text-slate-500 hover:text-rose-400 p-1 self-end sm:self-center transition-colors"
                                          title="Remove File"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                                    <span className="text-[11px] text-slate-400">
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
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                                  Your Vault Documents & Access Security Status ({myDocuments.length})
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {myDocuments.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <div className="truncate">
                                          <span className="font-semibold text-slate-200 block truncate">
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
                                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-300 rounded-lg border border-slate-800 transition-colors"
                                          title="Manage Access & Permissions"
                                        >
                                          <Key className="w-3.5 h-3.5" />
                                        </button>

                                        <a
                                          href={documentsApi.getDocumentDownloadUrl(doc.id)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-lg border border-slate-800 transition-colors"
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
            </Card>
          </div>
        )}
      </main>

      {/* MANAGE ACCESS MODAL */}
      {managingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 border-slate-800 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Manage Access — {managingDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setManagingDoc(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 font-medium block">Document Title: {managingDoc.title}</span>
                  <span className="text-slate-500 text-[11px] block">Filename: {managingDoc.filename}</span>
                </div>
                <div>{renderSecurityStatusBadge(managingDoc)}</div>
              </div>

              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] pt-1">
                Active & Revoked Share Grants
              </h4>

              {(!managingDoc.shares || managingDoc.shares.length === 0) ? (
                <p className="text-slate-400 text-xs italic p-3 bg-slate-950 rounded-xl border border-slate-800">
                  This document is currently PRIVATE to you. No providers have been granted access.
                </p>
              ) : (
                <div className="space-y-2">
                  {managingDoc.shares.map((share) => (
                    <div
                      key={share.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-200 block">
                          Provider ID #{share.shared_with_provider_id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            share.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-indigo-500/10 text-indigo-300'
                          }`}>
                            {share.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? 'View + Download' : 'View Only'}
                          </span>
                          <span className="text-slate-500 text-[10px]">
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
                        <span className="text-slate-500 text-[11px] font-medium">Access Revoked</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
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
