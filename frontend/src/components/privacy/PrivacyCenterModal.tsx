import React, { useEffect, useState } from 'react';
import {
  Lock,
  X,
  ShieldAlert,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  FolderLock,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { documentsApi } from '../../api';
import { PrivacySummary, DocumentSharePermission, DocumentShareStatus } from '../../types';

interface PrivacyCenterModalProps {
  requestId: number;
  onClose: () => void;
}

export const PrivacyCenterModal: React.FC<PrivacyCenterModalProps> = ({
  requestId,
  onClose,
}) => {
  const [privacySummary, setPrivacySummary] = useState<PrivacySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [revokingProviderId, setRevokingProviderId] = useState<number | null>(null);

  const fetchPrivacySummary = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await documentsApi.getPrivacySummary(requestId);
      setPrivacySummary(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load privacy & access permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivacySummary();
  }, [requestId]);

  const handleRevokeShare = async (documentId: number, providerId: number) => {
    setRevokingProviderId(providerId);
    setErrorMessage(null);
    try {
      await documentsApi.revokeDocument(documentId, providerId);
      setActionSuccess(`Access revoked for provider #${providerId}!`);
      await fetchPrivacySummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to revoke document access.');
    } finally {
      setRevokingProviderId(null);
    }
  };

  const handleUpdatePermission = async (
    documentId: number,
    providerId: number,
    permission: DocumentSharePermission
  ) => {
    setErrorMessage(null);
    try {
      await documentsApi.shareDocument(documentId, providerId, permission);
      setActionSuccess(`Updated permission to ${permission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? 'View + Download' : 'View Only'}!`);
      await fetchPrivacySummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update document permission.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#29352D]/50 backdrop-blur-sm">
      <Card className="max-w-2xl w-full max-h-[90vh] flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C8D7C7] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#29352D] tracking-tight">
                Privacy & Access Control Center
              </h2>
              <span className="text-xs text-[#617066]">
                Manage explicit citizen document permissions & instant revocation
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#617066] hover:text-[#29352D] p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECURITY NOTICE BANNER */}
        <div className="p-4 bg-[#DDE8DC] border border-[#C8D7C7] rounded-xl space-y-1 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1F4724]">
            <FolderLock className="w-4 h-4 text-[#7C9A82]" />
            <span>Default Privacy Guarantee</span>
          </div>
          <p className="text-[11px] text-[#29352D] leading-relaxed">
            Connecting with a legal provider does NOT grant automatic access to your vault documents.
            Documents remain strictly private until explicitly shared by you.
          </p>
        </div>

        {actionSuccess && (
          <div className="p-3 bg-[#D4E5D4] border border-[#B2D4B2] text-[#1F4724] text-xs rounded-xl font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-[#1F4724]">✕</button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-[#F4D6D6] border border-[#E8B4B4] text-[#5C1D1D] text-xs rounded-xl font-semibold">
            {errorMessage}
          </div>
        )}

        {isLoading && (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#7C9A82] animate-spin mx-auto" />
            <p className="text-xs text-[#617066]">Fetching document access matrix...</p>
          </div>
        )}

        {!isLoading && privacySummary && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <span className="text-xs font-bold text-[#617066] uppercase tracking-wider block">
              Document Access Grants ({privacySummary.items.length})
            </span>

            {privacySummary.items.length === 0 ? (
              <div className="p-8 text-center bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-xs text-[#617066]">
                No documents found in your vault for this request.
              </div>
            ) : (
              <div className="space-y-2.5">
                {privacySummary.items.map((item, idx) => {
                  const isPrivate = !item.provider_id;
                  const isRevoked = item.share_status === DocumentShareStatus.REVOKED;

                  return (
                    <div
                      key={`${item.document_id}-${item.provider_id || 'p'}-${idx}`}
                      className="p-3.5 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#29352D]">{item.title}</span>
                          {isPrivate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E2E8E2] text-[#3A473E] border border-[#C4D0C4] flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Private
                            </span>
                          ) : isRevoked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F4D6D6] text-[#5C1D1D] border border-[#E8B4B4] flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Access Revoked
                            </span>
                          ) : item.permission === DocumentSharePermission.VIEW_AND_DOWNLOAD ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#D4E5D4] text-[#1F4724] border border-[#B2D4B2] flex items-center gap-1">
                              <Download className="w-3 h-3" /> View + Download
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6E2F0] text-[#3D3352] border border-[#CBBFE0] flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View Only
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-[#617066] block">
                          File: {item.filename} {item.provider_name ? `• Shared with ${item.provider_name}` : ''}
                        </span>
                      </div>

                      {item.provider_id && item.share_status === DocumentShareStatus.ACTIVE && (
                        <div className="flex items-center gap-2 shrink-0">
                          {item.permission === DocumentSharePermission.VIEW ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdatePermission(item.document_id, item.provider_id!, DocumentSharePermission.VIEW_AND_DOWNLOAD)}
                            >
                              Allow Download
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdatePermission(item.document_id, item.provider_id!, DocumentSharePermission.VIEW)}
                            >
                              Set View Only
                            </Button>
                          )}

                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={revokingProviderId === item.provider_id}
                            onClick={() => handleRevokeShare(item.document_id, item.provider_id!)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Revoke Access
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-[#C8D7C7] shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Privacy Center
          </Button>
        </div>
      </Card>
    </div>
  );
};
