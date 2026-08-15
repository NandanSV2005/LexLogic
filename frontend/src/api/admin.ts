import { apiClient } from './client';
import { AuditLogItem, Provider } from '../types';

export interface AuditLogQuery {
  action?: string;
  user_id?: number;
  resource_type?: string;
  limit?: number;
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
};
