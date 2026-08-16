import { apiClient } from './client';
import {
  Provider,
  ProviderType,
  ProviderDashboardMetrics,
  AvailabilityStatus,
  VerificationStatus,
  PointTransactionOut,
  PointsSummaryOut,
} from '../types';

export interface CreateProviderProfileData {
  provider_type: ProviderType;
  full_name: string;
  phone?: string;
  location?: string;
  experience_years: number;
  bio?: string;
}

export interface UpdateProviderProfileData {
  provider_type?: ProviderType;
  full_name?: string;
  phone?: string;
  location?: string;
  experience_years?: number;
  bio?: string;
}

export interface UpdateGenericFieldsData {
  fields: Array<{ field_name: string; value: string }>;
}

export const providersApi = {
  createProfile: async (data: CreateProviderProfileData): Promise<Provider> => {
    const response = await apiClient.post<Provider>('/api/providers/profile', data);
    return response.data;
  },

  getMe: async (): Promise<Provider> => {
    const response = await apiClient.get<Provider>('/api/providers/me');
    return response.data;
  },

  updateProfile: async (data: UpdateProviderProfileData): Promise<Provider> => {
    const response = await apiClient.put<Provider>('/api/providers/me', data);
    return response.data;
  },

  updateGenericFields: async (data: UpdateGenericFieldsData): Promise<Provider> => {
    const response = await apiClient.put<Provider>('/api/providers/fields', data);
    return response.data;
  },

  getDashboard: async (): Promise<ProviderDashboardMetrics> => {
    const response = await apiClient.get<ProviderDashboardMetrics>('/api/providers/me/dashboard');
    return response.data;
  },

  updateAvailability: async (availability_status: AvailabilityStatus): Promise<Provider> => {
    const response = await apiClient.put<Provider>('/api/providers/availability', {
      availability_status,
    });
    return response.data;
  },

  submitVerification: async (notes?: string): Promise<Provider> => {
    const response = await apiClient.post<Provider>('/api/providers/me/verification', { notes });
    return response.data;
  },

  verifyProvider: async (providerId: number, status: VerificationStatus): Promise<Provider> => {
    const response = await apiClient.put<Provider>(`/api/providers/${providerId}/verify`, {
      verification_status: status,
    });
    return response.data;
  },

  getPublicProfile: async (providerId: number): Promise<Provider> => {
    const response = await apiClient.get<Provider>(`/api/providers/${providerId}`);
    return response.data;
  },

  getPointsSummary: async (): Promise<PointsSummaryOut> => {
    const response = await apiClient.get<PointsSummaryOut>('/api/providers/me/points');
    return response.data;
  },

  getPointsHistory: async (): Promise<PointTransactionOut[]> => {
    const response = await apiClient.get<PointTransactionOut[]>('/api/providers/me/points/history');
    return response.data;
  },
};
