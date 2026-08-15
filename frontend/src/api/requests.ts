import { apiClient } from './client';
import {
  ServiceRequest,
  ProviderType,
  RequestUrgency,
  RequestStatus,
  InteractionStatus,
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
};
