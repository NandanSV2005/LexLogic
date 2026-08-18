import { apiClient } from './client';
import {
  ServiceRequest,
  ProviderType,
  RequestUrgency,
  RequestStatus,
  InteractionStatus,
  InterestedProvider,
  WorkspaceSummary,
} from '../types';

export interface CreateServiceRequestData {
  service_category: string;
  description: string;
  location: string;
  preferred_provider_type: ProviderType;
  urgency?: RequestUrgency;
  legal_aid_interest?: boolean;
}

export const requestsApi = {
  createRequest: async (data: CreateServiceRequestData): Promise<ServiceRequest> => {
    const response = await apiClient.post<ServiceRequest>('/api/requests', data);
    return response.data;
  },

  listMyRequests: async (): Promise<ServiceRequest[]> => {
    const response = await apiClient.get<ServiceRequest[]>('/api/requests/me');
    return response.data;
  },

  getEligibleRequests: async (): Promise<ServiceRequest[]> => {
    const response = await apiClient.get<ServiceRequest[]>('/api/requests/eligible');
    return response.data;
  },

  getRequestDetails: async (requestId: number): Promise<ServiceRequest> => {
    const response = await apiClient.get<ServiceRequest>(`/api/requests/${requestId}`);
    return response.data;
  },

  updateRequestStatus: async (requestId: number, status: RequestStatus): Promise<ServiceRequest> => {
    const response = await apiClient.put<ServiceRequest>(`/api/requests/${requestId}/status`, {
      status,
    });
    return response.data;
  },

  respondToRequest: async (
    requestId: number,
    action: 'ACCEPT' | 'DECLINE' | 'CONTACT' = 'ACCEPT'
  ): Promise<{ request_id: number; status: InteractionStatus }> => {
    const response = await apiClient.post(`/api/requests/${requestId}/respond`, { action });
    return response.data;
  },

  completeRequest: async (requestId: number): Promise<ServiceRequest> => {
    const response = await apiClient.post<ServiceRequest>(`/api/requests/${requestId}/complete`);
    return response.data;
  },

  requestCompletion: async (requestId: number): Promise<ServiceRequest> => {
    const response = await apiClient.post<ServiceRequest>(`/api/requests/${requestId}/request-completion`);
    return response.data;
  },

  confirmCompletion: async (requestId: number): Promise<ServiceRequest> => {
    const response = await apiClient.post<ServiceRequest>(`/api/requests/${requestId}/confirm-completion`);
    return response.data;
  },

  listMyProviderCases: async (): Promise<ServiceRequest[]> => {
    const response = await apiClient.get<ServiceRequest[]>('/api/requests/provider/my-cases');
    return response.data;
  },

  requestDocuments: async (requestId: number, requestedDocuments: string): Promise<void> => {
    await apiClient.post(`/api/requests/${requestId}/request-documents`, {
      requested_documents: requestedDocuments,
    });
  },

  getInterestedProviders: async (requestId: number): Promise<InterestedProvider[]> => {
    const response = await apiClient.get<InterestedProvider[]>(`/api/requests/${requestId}/interested-providers`);
    return response.data;
  },

  acceptProvider: async (requestId: number, providerId: number): Promise<ServiceRequest> => {
    const response = await apiClient.post<ServiceRequest>(`/api/requests/${requestId}/accept-provider/${providerId}`);
    return response.data;
  },

  getCaseWorkspace: async (requestId: number): Promise<WorkspaceSummary> => {
    const response = await apiClient.get<WorkspaceSummary>(`/api/requests/${requestId}/workspace`);
    return response.data;
  },
};


