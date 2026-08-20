import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Filter,
  Calendar,
  AlertCircle,
  FileCheck,
  ShieldAlert,
  UserCheck,
  Clock,
} from 'lucide-react';
import { AdminNavbar } from '../../components/layout/AdminNavbar';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi, providersApi } from '../../api';
import {
  AdminVerificationQueueItem,
  ProviderType,
  DetailedVerificationStatus,
  VerificationStatus,
} from '../../types';

export const AdminProvidersPage: React.FC = () => {
  const [queueItems, setQueueItems] = useState<AdminVerificationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters State
  const [professionFilter, setProfessionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [manualReviewOnly, setManualReviewOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Decision Modal State
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [modalAction, setModalAction] = useState<string>('APPROVE_CREDENTIAL');
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);

  const fetchQueue = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await adminApi.getVerificationQueue({
        profession: professionFilter !== 'ALL' ? professionFilter : undefined,
        verification_status: statusFilter !== 'ALL' ? statusFilter : undefined,
        manual_review_only: manualReviewOnly || undefined,
        date_from: dateFilter ? dateFilter : undefined,
      });
      setQueueItems(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load verification queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [professionFilter, statusFilter, manualReviewOnly, dateFilter]);

  const handleOpenDecisionModal = (providerId: number, action: string) => {
    setSelectedProviderId(providerId);
    setModalAction(action);
    setDecisionNotes('');
  };

  const handleExecuteDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId) return;

    if (!decisionNotes.trim()) {
      alert('Please enter a reason or note for this admin verification decision.');
      return;
    }

    setIsSubmittingDecision(true);
    setErrorMessage(null);

    try {
      await adminApi.executeVerificationDecision(
        selectedProviderId,
        modalAction,
        decisionNotes
      );

      setSuccessMessage(
        `Verification decision (${modalAction}) submitted successfully with audit trail note.`
      );
      setSelectedProviderId(null);
      setDecisionNotes('');
      await fetchQueue();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit verification decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const renderStatusBadge = (st: DetailedVerificationStatus) => {
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

  const filteredItems = queueItems.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.full_name?.toLowerCase().includes(q);
      const matchEmail = item.user_email?.toLowerCase().includes(q);
      const matchProf = item.profession?.toLowerCase().includes(q);
      return matchName || matchEmail || matchProf;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-6 h-6 text-[#8EA895]" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
                Admin Provider Verification Center
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#A3B5A7]">
              Review queue, identity credentials, practice evidence, and audit verification decisions across legal professions.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchQueue}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Queue
          </Button>
        </div>

        {errorMessage && (
          <ErrorState title="Verification Center Error" message={errorMessage} onRetry={fetchQueue} />
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

        {/* Multi-Filter Bar */}
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Filter by Profession */}
            <div>
              <label className="block text-[#A3B5A7] font-bold mb-1">Profession Filter</label>
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-2 text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
              >
                <option value="ALL">All Professions</option>
                <option value="ADVOCATE">Advocate / Legal Counsel</option>
                <option value="MEDIATOR">Mediator</option>
                <option value="ARBITRATOR">Arbitrator</option>
                <option value="NOTARY">Notary Public</option>
                <option value="DOCUMENT_WRITER">Document Writer</option>
              </select>
            </div>

            {/* Filter by Verification Status */}
            <div>
              <label className="block text-[#A3B5A7] font-bold mb-1">Verification Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-2 text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="MANUAL_REVIEW">Manual Review Required</option>
                <option value="AUTOMATED_REVIEW">Automated Review</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Filter by Date */}
            <div>
              <label className="block text-[#A3B5A7] font-bold mb-1">Submitted After Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-[#1C261F] border border-[#2D3D32] rounded-xl px-3 py-1.5 text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
              />
            </div>

            {/* Search Box */}
            <div>
              <label className="block text-[#A3B5A7] font-bold mb-1">Search Provider</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#74887A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-xs text-[#E6EFE8] placeholder-[#74887A] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#2D3D32] text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[#E6EFE8] font-bold">
              <input
                type="checkbox"
                checked={manualReviewOnly}
                onChange={(e) => setManualReviewOnly(e.target.checked)}
                className="w-4 h-4 accent-[#8EA895] rounded"
              />
              Show Manual Review Required Only
            </label>

            <span className="text-[#A3B5A7]">
              Showing <strong className="text-[#8EA895]">{filteredItems.length}</strong> providers in verification queue
            </span>
          </div>
        </Card>

        {isLoading && (
          <div className="py-20">
            <LoadingState message="Fetching admin provider verification queue..." />
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="p-12 bg-[#233027] border border-[#2D3D32] rounded-2xl text-center">
            <p className="text-xs text-[#A3B5A7]">No provider verification entries match the filter criteria.</p>
          </div>
        )}

        {/* Queue Table */}
        {!isLoading && filteredItems.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1C261F] text-[#A3B5A7] uppercase font-bold text-[10px] tracking-wider border-b border-[#2D3D32]">
                  <tr>
                    <th className="py-3.5 px-4">Provider</th>
                    <th className="py-3.5 px-4">Profession</th>
                    <th className="py-3.5 px-4">Verification Status</th>
                    <th className="py-3.5 px-4">Submission Date</th>
                    <th className="py-3.5 px-4">Credential Status</th>
                    <th className="py-3.5 px-4">Practice Evidence</th>
                    <th className="py-3.5 px-4">Last Activity</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3D32] text-[#E6EFE8]">
                  {filteredItems.map((item) => (
                    <tr key={item.provider_id} className="hover:bg-[#1C261F]/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold">
                        <div>{item.full_name}</div>
                        <div className="text-[10px] text-[#A3B5A7] font-normal">{item.user_email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="purple">{item.profession}</Badge>
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(item.overall_status)}</td>
                      <td className="py-3.5 px-4 text-[#A3B5A7]">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">{renderStatusBadge(item.credential_status)}</td>
                      <td className="py-3.5 px-4">{renderStatusBadge(item.practice_evidence_status)}</td>
                      <td className="py-3.5 px-4 text-[#A3B5A7] max-w-xs truncate">
                        {item.last_activity_notes || (item.last_activity_timestamp ? new Date(item.last_activity_timestamp).toLocaleString() : 'N/A')}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <Link to={`/admin/providers/${item.provider_id}`}>
                          <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                            Review Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Decision Modal */}
        {selectedProviderId !== null && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-extrabold text-[#E6EFE8]">
                Admin Decision — Provider #{selectedProviderId}
              </h3>

              <form onSubmit={handleExecuteDecision} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#A3B5A7] font-bold mb-1">Decision Action</label>
                  <select
                    value={modalAction}
                    onChange={(e) => setModalAction(e.target.value)}
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
                    placeholder="Enter audit rationale for this verification decision..."
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
                    onClick={() => setSelectedProviderId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingDecision}
                  >
                    Submit Decision
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
