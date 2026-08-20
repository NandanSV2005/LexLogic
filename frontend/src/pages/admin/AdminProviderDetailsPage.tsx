import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Briefcase,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Building,
  HelpCircle,
  AlertTriangle,
  History,
  Download,
  UserCheck,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi, providersApi } from '../../api';
import {
  AdminVerificationDetailsOut,
  DetailedVerificationStatus,
  AdvocateCaseReference,
} from '../../types';

export const AdminProviderDetailsPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();

  const [details, setDetails] = useState<AdminVerificationDetailsOut | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Decision Modal State
  const [showDecisionModal, setShowDecisionModal] = useState<boolean>(false);
  const [decisionAction, setDecisionAction] = useState<string>('APPROVE_CREDENTIAL');
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  // Practice Evidence Case Review Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [caseReviewStatus, setCaseReviewStatus] = useState<string>('VERIFIED');
  const [caseReviewNotes, setCaseReviewNotes] = useState<string>('');
  const [caseSourceRef, setCaseSourceRef] = useState<string>('');
  const [isSubmittingCaseReview, setIsSubmittingCaseReview] = useState<boolean>(false);

  const fetchDetails = async () => {
    if (!providerId) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await adminApi.getVerificationDetails(Number(providerId));
      setDetails(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load provider verification details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [providerId]);

  const handleOpenDecisionModal = (action: string) => {
    setDecisionAction(action);
    setDecisionNotes('');
    setShowDecisionModal(true);
  };

  const handleExecuteDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId || !details) return;

    if (!decisionNotes.trim()) {
      alert('Decision reason note is required for the admin audit log.');
      return;
    }

    setIsSubmittingDecision(true);
    setErrorMessage(null);

    try {
      const updated = await adminApi.executeVerificationDecision(
        details.provider_id,
        decisionAction,
        decisionNotes
      );
      setDetails(updated);
      setSuccessMessage(`Verification decision (${decisionAction}) executed and audit log recorded.`);
      setShowDecisionModal(false);
      setDecisionNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleOpenCaseReviewModal = (caseRef: AdvocateCaseReference) => {
    if (!caseRef.id) return;
    setSelectedCaseId(caseRef.id);
    setCaseReviewStatus('VERIFIED');
    setCaseReviewNotes('');
    setCaseSourceRef(caseRef.verification_notes || '');
  };

  const handleExecuteCaseReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;

    if (!caseReviewNotes.trim()) {
      alert('Case evidence review reason note is required for audit trail.');
      return;
    }

    setIsSubmittingCaseReview(true);
    setErrorMessage(null);

    try {
      await adminApi.reviewPracticeEvidence(
        selectedCaseId,
        caseReviewStatus,
        caseReviewNotes,
        caseSourceRef
      );
      setSuccessMessage(`Practice evidence case reference #${selectedCaseId} reviewed successfully.`);
      setSelectedCaseId(null);
      setCaseReviewNotes('');
      await fetchDetails();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to review case evidence.');
    } finally {
      setIsSubmittingCaseReview(false);
    }
  };

  const renderStatusBadge = (st?: DetailedVerificationStatus) => {
    switch (st) {
      case DetailedVerificationStatus.VERIFIED:
        return <Badge variant="success">VERIFIED</Badge>;
      case DetailedVerificationStatus.REJECTED:
        return <Badge variant="danger">REJECTED</Badge>;
      case DetailedVerificationStatus.SUBMITTED:
        return <Badge variant="warning">SUBMITTED</Badge>;
      case DetailedVerificationStatus.MANUAL_REVIEW:
        return <Badge variant="purple">MANUAL REVIEW</Badge>;
      case DetailedVerificationStatus.AUTOMATED_REVIEW:
        return <Badge variant="indigo">AUTO REVIEW</Badge>;
      case DetailedVerificationStatus.NOT_STARTED:
      default:
        return <Badge variant="neutral">NOT STARTED</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/admin/providers"
            className="inline-flex items-center text-xs font-semibold text-[#8EA895] hover:text-[#A2BCA9] transition-colors gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Verification Queue
          </Link>
        </div>

        {errorMessage && (
          <ErrorState title="Verification Details Error" message={errorMessage} onRetry={fetchDetails} />
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
            <LoadingState message="Fetching comprehensive provider verification file..." />
          </div>
        )}

        {!isLoading && details && (
          <div className="space-y-6">
            {/* Header / Identity Banner */}
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2D3D32]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-[#E6EFE8]">{details.full_name}</h1>
                    <Badge variant="purple">{details.profession}</Badge>
                  </div>
                  <p className="text-xs text-[#A3B5A7]">
                    User Email: <span className="text-[#E6EFE8] font-semibold">{details.user_email}</span> • Provider ID: #{details.provider_id} • Account User ID: #{details.user_id}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {renderStatusBadge(details.overall_status)}
                </div>
              </div>

              {/* SECTION 1: IDENTITY */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8EA895] uppercase tracking-wider">
                  <UserCheck className="w-4 h-4" /> Provider Identity Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32]">
                    <span className="text-[#A3B5A7] block text-[10px] font-bold">Contact Phone</span>
                    <span className="font-bold text-[#E6EFE8]">{details.phone || 'Not Provided'}</span>
                  </div>

                  <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32]">
                    <span className="text-[#A3B5A7] block text-[10px] font-bold">Primary Practice Location</span>
                    <span className="font-bold text-[#E6EFE8]">{details.location || 'Not Specified'}</span>
                  </div>

                  <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32]">
                    <span className="text-[#A3B5A7] block text-[10px] font-bold">Experience & Member Since</span>
                    <span className="font-bold text-[#E6EFE8]">{details.experience_years} Years ({new Date(details.created_at).toLocaleDateString()})</span>
                  </div>
                </div>

                {details.bio && (
                  <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] text-xs">
                    <span className="text-[#A3B5A7] block text-[10px] font-bold mb-1">Biography Summary</span>
                    <p className="text-[#E6EFE8] italic">"{details.bio}"</p>
                  </div>
                )}
              </div>

              {/* Admin Action Button Group */}
              <div className="pt-4 border-t border-[#2D3D32] space-y-2">
                <span className="text-xs font-bold text-[#A3B5A7] block">
                  Admin Credential & Verification Actions (Requires Audit Reason Note):
                </span>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenDecisionModal('APPROVE_CREDENTIAL')}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve Credential
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleOpenDecisionModal('REJECT_CREDENTIAL')}
                    leftIcon={<XCircle className="w-3.5 h-3.5" />}
                  >
                    Reject Credential
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDecisionModal('REQUEST_ADDITIONAL_INFO')}
                    leftIcon={<HelpCircle className="w-3.5 h-3.5" />}
                  >
                    Request Info / Re-submit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDecisionModal('MARK_MANUAL_REVIEW')}
                    leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-[#B3A7CF]" />}
                  >
                    Mark for Manual Review
                  </Button>
                </div>
              </div>
            </Card>

            {/* SECTION 2: PROFESSIONAL CREDENTIAL */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2D3D32]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#B3A7CF] uppercase tracking-wider">
                  <Briefcase className="w-4 h-4" /> Professional Credential Verification
                </div>
                {renderStatusBadge(details.credential_verification_status)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1">
                  <span className="text-[#A3B5A7] block text-[10px] font-bold">State Bar Council</span>
                  <span className="font-bold text-[#E6EFE8]">{details.state_bar_council || 'Not Submitted'}</span>
                </div>

                <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1">
                  <span className="text-[#A3B5A7] block text-[10px] font-bold">Enrollment Number & Year</span>
                  <span className="font-mono font-bold text-[#8EA895]">
                    {details.enrollment_number || 'N/A'} {details.enrollment_year ? `(${details.enrollment_year})` : ''}
                  </span>
                </div>

                <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1">
                  <span className="text-[#A3B5A7] block text-[10px] font-bold">Credential Type</span>
                  <span className="font-bold text-[#E6EFE8]">{details.credential_type || 'BAR_ENROLLMENT_CERTIFICATE'}</span>
                </div>

                <div className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1">
                  <span className="text-[#A3B5A7] block text-[10px] font-bold">Submitted Evidence Document</span>
                  {details.credential_document_id ? (
                    <div className="flex items-center gap-2 text-[#8EA895] font-bold">
                      <FileCheck className="w-4 h-4 shrink-0" />
                      <span>{details.credential_document_filename || `Document #${details.credential_document_id}`}</span>
                    </div>
                  ) : (
                    <span className="text-[#A3B5A7]">No credential document uploaded</span>
                  )}
                </div>
              </div>
            </Card>

            {/* SECTION 3: PRACTICE EVIDENCE */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2D3D32]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8EA895] uppercase tracking-wider">
                  <FileText className="w-4 h-4" /> Secondary Practice Evidence (Submitted Cases)
                </div>
                {renderStatusBadge(details.practice_status)}
              </div>

              {details.case_references && details.case_references.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1C261F] text-[#A3B5A7] uppercase font-bold text-[10px] tracking-wider border-b border-[#2D3D32]">
                      <tr>
                        <th className="py-2.5 px-3">Case Ref / Number</th>
                        <th className="py-2.5 px-3">Court / Tribunal</th>
                        <th className="py-2.5 px-3">Case Type</th>
                        <th className="py-2.5 px-3">Year</th>
                        <th className="py-2.5 px-3">Claimed Role</th>
                        <th className="py-2.5 px-3">Evidence Status</th>
                        <th className="py-2.5 px-3 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D3D32] text-[#E6EFE8]">
                      {details.case_references.map((c) => (
                        <tr key={c.id} className="hover:bg-[#1C261F]/50">
                          <td className="py-3 px-3 font-mono font-bold text-[#8EA895]">{c.case_number}</td>
                          <td className="py-3 px-3 font-bold">{c.court_name}</td>
                          <td className="py-3 px-3 text-[#A3B5A7]">{c.case_type || 'Civil Litigation'}</td>
                          <td className="py-3 px-3 text-[#A3B5A7]">{c.case_year || 'N/A'}</td>
                          <td className="py-3 px-3 font-semibold">{c.advocate_role || 'Counsel'}</td>
                          <td className="py-3 px-3">{renderStatusBadge(c.verification_status)}</td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCaseReviewModal(c)}
                            >
                              Review Evidence
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#A3B5A7] italic">No secondary practice case references submitted.</p>
              )}
            </Card>

            {/* SECTION 4: VERIFICATION HISTORY & AUDIT TRAIL */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#2D3D32] text-xs font-bold text-[#E6EFE8] uppercase tracking-wider">
                <History className="w-4 h-4 text-[#8EA895]" /> Auditable Verification Decision History
              </div>

              {details.history_entries && details.history_entries.length > 0 ? (
                <div className="space-y-3">
                  {details.history_entries.map((h) => (
                    <div key={h.id} className="p-3.5 bg-[#1C261F] rounded-xl border border-[#2D3D32] space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#8EA895]">{h.action}</span>
                        <span className="text-[#A3B5A7] text-[10px]">{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#A3B5A7] text-[11px]">
                        <span>Status Transition: <strong className="text-[#E6EFE8]">{h.from_status || 'NOT_STARTED'} → {h.to_status}</strong></span>
                        {h.actor_id && <span>• Admin Actor ID: #{h.actor_id}</span>}
                      </div>
                      {h.notes && (
                        <p className="text-[#E6EFE8] bg-[#141C16] p-2 rounded-lg text-[11px] mt-1 italic">
                          "{h.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#A3B5A7]">No verification decisions recorded yet.</p>
              )}
            </Card>
          </div>
        )}

        {/* Admin Credential Decision Modal */}
        {showDecisionModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-[#E6EFE8]">
                Execute Verification Decision
              </h3>

              <form onSubmit={handleExecuteDecision} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">Target Action</label>
                  <select
                    value={decisionAction}
                    onChange={(e) => setDecisionAction(e.target.value)}
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-2 text-[#E6EFE8] font-bold"
                  >
                    <option value="APPROVE_CREDENTIAL">Approve Professional Credential (VERIFIED)</option>
                    <option value="REJECT_CREDENTIAL">Reject Professional Credential (REJECTED)</option>
                    <option value="REQUEST_ADDITIONAL_INFO">Request Additional Information (MANUAL REVIEW)</option>
                    <option value="MARK_MANUAL_REVIEW">Mark for Manual Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">
                    Decision Reason / Audit Note <span className="text-[#E89D9D]">* Mandatory</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter explicit rationale for this admin verification decision..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl p-3 text-[#E6EFE8] placeholder-[#74887A] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDecisionModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingDecision}
                  >
                    Submit & Log Audit
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Practice Evidence Case Review Modal */}
        {selectedCaseId !== null && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-[#E6EFE8]">
                Review Case Evidence Reference #{selectedCaseId}
              </h3>

              <form onSubmit={handleExecuteCaseReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">Evidence Status</label>
                  <select
                    value={caseReviewStatus}
                    onChange={(e) => setCaseReviewStatus(e.target.value)}
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-2 text-[#E6EFE8] font-bold"
                  >
                    <option value="VERIFIED">VERIFIED (Confirmed Court Record)</option>
                    <option value="UNVERIFIED">UNVERIFIED (Unconfirmed Metadata)</option>
                    <option value="NEEDS_REVIEW">NEEDS REVIEW (Requires Clarification)</option>
                    <option value="REJECTED">REJECTED (Invalid Case Reference)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">Evidence Source Reference / Portal Link</label>
                  <input
                    type="text"
                    placeholder="e.g. eCourts India Case ID / High Court Orders Link"
                    value={caseSourceRef}
                    onChange={(e) => setCaseSourceRef(e.target.value)}
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-2 text-[#E6EFE8] font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">
                    Review Decision Reason Note <span className="text-[#E89D9D]">* Mandatory</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter explicit review note for this practice evidence reference..."
                    value={caseReviewNotes}
                    onChange={(e) => setCaseReviewNotes(e.target.value)}
                    className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl p-3 text-[#E6EFE8] placeholder-[#74887A] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCaseId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingCaseReview}
                  >
                    Save Case Review
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
