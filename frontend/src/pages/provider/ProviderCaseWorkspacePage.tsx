import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  FileText,
  Eye,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  X,
  FileCheck,
  Send,
  User,
  Info,
} from 'lucide-react';
import {
  ShieldAlert as ShieldAlertIcon,
  Lock as LockIcon,
  ShieldCheck as ShieldCheckIcon,
} from 'lucide-react';
import {
  ServiceRequest,
  RequestStatus,
  WorkspaceSummary,
  DocumentItem,
  DocumentSharePermission,
  DocumentVisibility,
} from '../../types';
import { requestsApi } from '../../api/requests';
import { documentsApi } from '../../api/documents';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';

export const ProviderCaseWorkspacePage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const reqId = Number(requestId);

  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [requestDocs, setRequestDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Document Request Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [requestedDocsInput, setRequestedDocsInput] = useState<string>('');
  const [isSubmittingDocReq, setIsSubmittingDocReq] = useState<boolean>(false);

  // Document Viewer Modal State
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);
  const [isFetchingBlob, setIsFetchingBlob] = useState<boolean>(false);

  const handleOpenDocumentViewer = async (doc: DocumentItem) => {
    setViewingDoc(doc);
    setIsFetchingBlob(true);
    setViewingBlobUrl(null);

    try {
      const blobUrl = await documentsApi.fetchDocumentBlobUrl(doc.id);
      setViewingBlobUrl(blobUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to stream document for secure preview.');
    } finally {
      setIsFetchingBlob(false);
    }
  };

  const handleCloseDocumentViewer = () => {
    if (viewingBlobUrl) {
      URL.revokeObjectURL(viewingBlobUrl);
    }
    setViewingBlobUrl(null);
    setViewingDoc(null);
  };

  // Action Loading State
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  const fetchWorkspaceData = async () => {
    if (!reqId || isNaN(reqId)) {
      setErrorMessage('Invalid service request ID');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [wsData, reqData, docsData] = await Promise.all([
        requestsApi.getCaseWorkspace(reqId).catch(() => null),
        requestsApi.getRequestDetails(reqId),
        documentsApi.listMyDocuments().catch(() => []),
      ]);

      setWorkspace(wsData);
      setRequest(reqData);

      // Filter documents belonging to this request
      const filtered = docsData.filter((d) => d.request_id === reqId);
      setRequestDocs(filtered);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load provider case workspace data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [reqId]);

  const handleSendDocumentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedDocsInput.trim()) return;

    setIsSubmittingDocReq(true);
    setErrorMessage(null);

    try {
      await requestsApi.requestDocuments(reqId, requestedDocsInput.trim());
      setSuccessMessage('Document request submitted to Citizen successfully!');
      setIsDocModalOpen(false);
      setRequestedDocsInput('');
      await fetchWorkspaceData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit document request.');
    } finally {
      setIsSubmittingDocReq(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!request) return;
    setIsCompleting(true);
    setErrorMessage(null);

    try {
      await requestsApi.requestCompletion(request.id);
      setSuccessMessage('Completion requested successfully! Awaiting Citizen confirmation.');
      await fetchWorkspaceData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to request service completion.');
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingState message="Loading Provider Case Workspace..." />
        </div>
      </div>
    );
  }

  if (errorMessage || !request) {
    return (
      <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          <Card className="p-8 text-center space-y-4 border-[#5E3232]">
            <AlertCircle className="w-12 h-12 text-[#E89D9D] mx-auto" />
            <h2 className="text-xl font-bold text-[#E6EFE8]">Workspace Access Error</h2>
            <p className="text-sm text-[#A3B5A7]">{errorMessage || 'Case request not found.'}</p>
            <Button variant="outline" onClick={() => navigate('/provider/dashboard')}>
              Return to Provider Dashboard
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/provider/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8EA895] hover:text-[#7ECB98] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Provider Dashboard
          </Link>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="p-4 bg-[#1B3B2B] border border-[#2D5E44] rounded-xl text-[#7ECB98] text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-[#7ECB98] hover:text-[#E6EFE8]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* HEADER: CASE / REQUEST HEADER */}
        <Card className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3D32] pb-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-[#8EA895] tracking-wider uppercase">
                  Request #{request.id}
                </span>
                <Badge variant="info">{request.service_category}</Badge>
                {request.urgency && <Badge variant="warning">Urgency: {request.urgency}</Badge>}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
                Case Workspace — {request.service_category}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#A3B5A7]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#8EA895]" /> Location: {request.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-[#8EA895]" /> Created:{' '}
                  {new Date(request.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <div className="text-xs font-semibold text-[#A3B5A7]">Case Connection Status:</div>
              {request.status === RequestStatus.IN_PROGRESS ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B3B2B] text-[#7ECB98] border border-[#2D5E44] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Connected & Active Representation
                </span>
              ) : request.status === RequestStatus.COMPLETION_REQUESTED ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#3B301D] text-[#E3BA7E] border border-[#5E4D2E] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Completion Requested (Awaiting Citizen)
                </span>
              ) : request.status === RequestStatus.COMPLETED ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1C261F] text-[#A3B5A7] border border-[#2D3D32] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Service Completed & Resolved
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2A2438] text-[#B3A7CF] border border-[#3D3452] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Pending Citizen Review
                </span>
              )}
            </div>
          </div>

          {/* SECTION 1 — CASE OVERVIEW */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#8EA895]" /> Section 1: Case Overview & Legal Description
            </h3>

            <div className="p-4 bg-[#141C16] border border-[#2D3D32] rounded-xl space-y-3">
              <p className="text-xs sm:text-sm text-[#E6EFE8] leading-relaxed whitespace-pre-line">
                "{request.description}"
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-[#2D3D32] text-xs">
                <div>
                  <span className="text-[#A3B5A7] block font-medium">Category:</span>
                  <span className="font-semibold text-[#E6EFE8]">{request.service_category}</span>
                </div>
                <div>
                  <span className="text-[#A3B5A7] block font-medium">Location:</span>
                  <span className="font-semibold text-[#E6EFE8]">{request.location}</span>
                </div>
                <div>
                  <span className="text-[#A3B5A7] block font-medium">Preferred Type:</span>
                  <span className="font-semibold text-[#E6EFE8]">{request.preferred_provider_type}</span>
                </div>
                <div>
                  <span className="text-[#A3B5A7] block font-medium">Current Status:</span>
                  <span className="font-semibold text-[#8EA895]">{request.status}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 2 — DOCUMENTS (REQUESTED & RECEIVED) */}
        <Card className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D3D32] pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#E6EFE8] tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8EA895]" /> Section 2: Case Documents & Permission Status
              </h3>
              <p className="text-xs text-[#A3B5A7]">
                Explicit citizen authorization is required for viewing. Revoked permissions return 403 Forbidden.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDocModalOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5 text-[#8EA895]" />}
            >
              Request Additional Document
            </Button>
          </div>

          {/* DOCUMENT STATUS FEED: 4 DISTINCT STATES */}
          <div className="space-y-4">
            {/* 1. DOCUMENTS REQUESTED BY PROVIDER */}
            {workspace?.connected_provider?.requested_documents && (
              <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#8EA895]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#8EA895]" /> Outstanding Document Request
                  </span>
                  <Badge variant="warning">Status: Awaiting Citizen Upload</Badge>
                </div>
                <p className="text-xs text-[#E6EFE8]">
                  "{workspace.connected_provider.requested_documents}"
                </p>
              </div>
            )}

            {/* 2. RECEIVED & SHARED DOCUMENTS */}
            {requestDocs.length === 0 ? (
              <EmptyState
                title="No Case Documents Currently Shared"
                description="Once the citizen uploads and explicitly grants document access, shared files will appear here for review."
              />
            ) : (
              <div className="divide-y divide-[#2D3D32] border border-[#2D3D32] rounded-xl overflow-hidden">
                {requestDocs.map((doc) => {
                  const perm = doc.current_user_permission;
                  const isRevoked = doc.visibility === DocumentVisibility.REVOKED;
                  const isSharedActive = perm && !isRevoked;
                  const isAwaitingPermission = !perm && doc.visibility === DocumentVisibility.PRIVATE;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 bg-[#141C16] hover:bg-[#18221B] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#E6EFE8]">{doc.title}</span>
                          <span className="text-[11px] text-[#A3B5A7]">({doc.filename})</span>
                          <span className="text-[10px] text-[#8EA895] font-mono">v{doc.version_number}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A3B5A7]">
                          <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                          <span>Size: {(doc.file_size_bytes / 1024).toFixed(1)} KB</span>
                          <span>Type: {doc.mime_type}</span>
                        </div>
                      </div>

                      {/* PERMISSION BADGE & ACTION */}
                      <div className="flex items-center gap-3">
                        {isRevoked ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#3D2020] text-[#E89D9D] border border-[#5E3232] flex items-center gap-1">
                            <ShieldAlertIcon className="w-3.5 h-3.5" /> Access Revoked
                          </span>
                        ) : isAwaitingPermission ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#3B301D] text-[#E3BA7E] border border-[#5E4D2E] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Uploaded / Awaiting Citizen Permission
                          </span>
                        ) : isSharedActive ? (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1B3B2B] text-[#7ECB98] border border-[#2D5E44] flex items-center gap-1">
                              <ShieldCheckIcon className="w-3.5 h-3.5" />
                              {perm === DocumentSharePermission.VIEW_AND_DOWNLOAD
                                ? 'Permission: View + Download'
                                : 'Permission: View Only'}
                            </span>

                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenDocumentViewer(doc)}
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              VIEW DOCUMENT
                            </Button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1C261F] text-[#A3B5A7] border border-[#2D3D32] flex items-center gap-1">
                            <LockIcon className="w-3.5 h-3.5" /> Private Document
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* SECTION 3 — DOCUMENT VIEWER MODAL */}
        {viewingDoc && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#141C16] border border-[#2D3D32] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              {/* MODAL HEADER */}
              <div className="p-4 border-b border-[#2D3D32] flex items-center justify-between bg-[#1C261F]">
                <div>
                  <h3 className="text-base font-extrabold text-[#E6EFE8] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#8EA895]" />
                    {viewingDoc.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-[#A3B5A7] mt-0.5">
                    <span>File: {viewingDoc.filename}</span>
                    <span>Version: v{viewingDoc.version_number}</span>
                    <span className="text-[#7ECB98] font-semibold">
                      {viewingDoc.current_user_permission === DocumentSharePermission.VIEW_AND_DOWNLOAD
                        ? 'View + Download Authorized'
                        : 'View Only Permission'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCloseDocumentViewer}
                  className="p-2 text-[#A3B5A7] hover:text-[#E6EFE8] rounded-lg bg-[#141C16] border border-[#2D3D32]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* EMBEDDED DOCUMENT VIEWING STREAM */}
              <div className="flex-1 bg-[#0D120E] p-4 overflow-auto min-h-[400px] flex items-center justify-center">
                {isFetchingBlob ? (
                  <LoadingState message="Fetching secure document stream..." />
                ) : viewingBlobUrl ? (
                  viewingDoc.mime_type.includes('image') ? (
                    <img
                      src={viewingBlobUrl}
                      alt={viewingDoc.title}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg border border-[#2D3D32]"
                    />
                  ) : (
                    <iframe
                      src={viewingBlobUrl}
                      title={viewingDoc.title}
                      className="w-full h-[55vh] rounded-lg border border-[#2D3D32]"
                    />
                  )
                ) : (
                  <div className="text-center space-y-3 p-8 border border-[#2D3D32] rounded-xl bg-[#141C16]">
                    <FileCheck className="w-12 h-12 text-[#8EA895] mx-auto" />
                    <h4 className="text-sm font-bold text-[#E6EFE8]">
                      Inline preview unavailable for format ({viewingDoc.mime_type})
                    </h4>
                    <p className="text-xs text-[#A3B5A7]">
                      This document has been verified under active citizen permission.
                    </p>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="p-4 border-t border-[#2D3D32] flex items-center justify-between bg-[#1C261F]">
                <span className="text-xs text-[#A3B5A7]">
                  Application-level RBAC: Access logged to audit ledger.
                </span>

                {viewingDoc.current_user_permission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? (
                  <a
                    href={documentsApi.getDocumentDownloadUrl(viewingDoc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-4 bg-[#1B3B2B] hover:bg-[#26543D] border border-[#2D5E44] text-[#7ECB98] font-semibold text-xs rounded-xl transition-all inline-flex items-center gap-1.5"
                  >
                    Download File
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-[#A3B5A7] bg-[#141C16] px-3 py-1.5 rounded-lg border border-[#2D3D32]">
                    Download Disabled (View Only Permission Granted)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4 — DOCUMENT REQUEST MODAL */}
        {isDocModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#141C16] border border-[#2D3D32] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
                <h3 className="text-base font-extrabold text-[#E6EFE8] flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#8EA895]" /> Section 4: Request Case Document
                </h3>
                <button onClick={() => setIsDocModalOpen(false)} className="text-[#A3B5A7] hover:text-[#E6EFE8]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSendDocumentRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider">
                    Specify Required Document(s)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={requestedDocsInput}
                    onChange={(e) => setRequestedDocsInput(e.target.value)}
                    placeholder="e.g. Property Title Deed, Land Registry Extract, Survey Map..."
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl p-3 text-xs text-[#E6EFE8] focus:outline-none focus:border-[#8EA895]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsDocModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" isLoading={isSubmittingDocReq}>
                    Submit Document Request
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* GRID: CASE TIMELINE (SECTION 5), APPOINTMENTS (SECTION 6), CASE ACTIONS (SECTION 8) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SECTION 5 — CASE TIMELINE & SECTION 7 CASE UPDATES */}
          <Card className="p-6 lg:col-span-2 space-y-6">
            <h3 className="text-base font-extrabold text-[#E6EFE8] tracking-tight flex items-center gap-2 border-b border-[#2D3D32] pb-4">
              <Clock className="w-5 h-5 text-[#8EA895]" /> Section 5 & 7: Case Timeline & Real Activity Audit
            </h3>

            {!workspace?.timeline || workspace.timeline.length === 0 ? (
              <p className="text-xs text-[#A3B5A7]">No activity logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2D3D32]">
                {workspace.timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative space-y-1">
                    <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#8EA895] ring-4 ring-[#141C16]" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#E6EFE8]">{event.title}</span>
                      <span className="text-[11px] text-[#A3B5A7]">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#A3B5A7] leading-relaxed">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SECTION 6 — APPOINTMENTS & SECTION 8 — CONTEXTUAL CASE ACTIONS */}
          <div className="space-y-8">
            {/* SECTION 6 — APPOINTMENTS */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider flex items-center gap-2 border-b border-[#2D3D32] pb-3">
                <Calendar className="w-4 h-4 text-[#8EA895]" /> Section 6: Case Appointments
              </h3>

              <div className="p-4 bg-[#141C16] border border-[#2D3D32] rounded-xl text-center space-y-2">
                <Info className="w-8 h-8 text-[#8EA895] mx-auto" />
                <p className="text-xs font-semibold text-[#E6EFE8]">No upcoming appointments scheduled</p>
                <p className="text-[11px] text-[#A3B5A7]">
                  Appointments created via consultation booking will synchronize here automatically.
                </p>
              </div>
            </Card>

            {/* SECTION 8 — CASE ACTIONS */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#E6EFE8] uppercase tracking-wider flex items-center gap-2 border-b border-[#2D3D32] pb-3">
                <Briefcase className="w-4 h-4 text-[#8EA895]" /> Section 8: Contextual Case Actions
              </h3>

              <div className="space-y-3">
                {request.status === RequestStatus.IN_PROGRESS && (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    isLoading={isCompleting}
                    onClick={handleMarkCompleted}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Mark Ready for Service / Submit Completion
                  </Button>
                )}

                {request.status === RequestStatus.COMPLETION_REQUESTED && (
                  <div className="p-3 bg-[#3B301D] border border-[#5E4D2E] rounded-xl text-[#E3BA7E] text-xs text-center font-semibold">
                    Completion submitted. Waiting for Citizen confirmation.
                  </div>
                )}

                {request.status === RequestStatus.COMPLETED && (
                  <div className="p-3 bg-[#1B3B2B] border border-[#2D5E44] rounded-xl text-[#7ECB98] text-xs text-center font-semibold">
                    ✓ Service successfully closed & resolved.
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsDocModalOpen(true)}
                  leftIcon={<FileText className="w-3.5 h-3.5" />}
                >
                  Request Additional Document
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
