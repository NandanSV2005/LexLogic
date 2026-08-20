import { apiClient } from './client';
import {
  AuditLogItem,
  Provider,
  AdminVerificationQueueItem,
  AdminVerificationDetailsOut,
  AdvocateCaseReference,
} from '../types';

export interface AuditLogQuery {
  action?: string;
  user_id?: number;
  resource_type?: string;
  limit?: number;
}

export interface AdminQueueFilters {
  profession?: string;
  verification_status?: string;
  manual_review_only?: boolean;
  date_from?: string;
  date_to?: string;
}

export const adminApi = {
  getAuditLogs: async (query?: AuditLogQuery): Promise<AuditLogItem[]> => {
    const response = await apiClient.get<AuditLogItem[]>('/api/audit', {
      params: query,
    });
    return response.data;
  },

  listAllProviders: async (maxRange: number = 20): Promise<Provider[]> => {
    const providerPromises = Array.from({ length: maxRange }, (_, i) => i + 1).map((id) =>
      apiClient
        .get<Provider>(`/api/providers/${id}`)
        .then((res) => res.data)
        .catch(() => null)
    );

    const results = await Promise.all(providerPromises);
    return results.filter((p): p is Provider => p !== null);
  },

  getVerificationQueue: async (filters?: AdminQueueFilters): Promise<AdminVerificationQueueItem[]> => {
    const response = await apiClient.get<AdminVerificationQueueItem[]>('/api/providers/admin/verification-queue', {
      params: filters,
    });
    return response.data;
  },

  getVerificationDetails: async (providerId: number): Promise<AdminVerificationDetailsOut> => {
    const response = await apiClient.get<AdminVerificationDetailsOut>(
      `/api/providers/admin/${providerId}/verification-details`
    );
    return response.data;
  },

  executeVerificationDecision: async (
    providerId: number,
    action: string,
    notes: string,
    targetStatus?: string
  ): Promise<AdminVerificationDetailsOut> => {
    const response = await apiClient.post<AdminVerificationDetailsOut>(
      `/api/providers/admin/${providerId}/verification/decision`,
      {
        action,
        notes,
        target_status: targetStatus,
      }
    );
    return response.data;
  },

  reviewPracticeEvidence: async (
    caseId: number,
    status: string,
    notes: string,
    evidenceSourceRef?: string
  ): Promise<AdvocateCaseReference> => {
    const response = await apiClient.put<AdvocateCaseReference>(
      `/api/providers/verification/practice-evidence/${caseId}/review`,
      {
        status,
        notes,
        evidence_source_reference: evidenceSourceRef,
      }
    );
    return response.data;
  },
};
