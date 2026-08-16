import { apiClient, API_BASE_URL } from './client';
import { DocumentItem, DocumentShareItem } from '../types';

export const documentsApi = {
  uploadDocument: async (title: string, file: File): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    const response = await apiClient.post<DocumentItem>('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  listMyDocuments: async (): Promise<DocumentItem[]> => {
    const response = await apiClient.get<DocumentItem[]>('/api/documents');
    return response.data;
  },

  listSharedWithMe: async (): Promise<DocumentItem[]> => {
    const response = await apiClient.get<DocumentItem[]>('/api/documents/provider/shared');
    return response.data;
  },

  shareDocument: async (documentId: number, providerId: number): Promise<DocumentShareItem> => {
    const response = await apiClient.post<DocumentShareItem>(`/api/documents/${documentId}/share`, {
      provider_id: providerId,
    });
    return response.data;
  },

  revokeDocument: async (documentId: number, providerId: number): Promise<DocumentShareItem> => {
    const response = await apiClient.post<DocumentShareItem>(`/api/documents/${documentId}/revoke`, {
      provider_id: providerId,
    });
    return response.data;
  },

  downloadDocumentUrl: (documentId: number): string => {
    const token = sessionStorage.getItem('lexlogic_token') || localStorage.getItem('lexlogic_token');
    return `${API_BASE_URL}/api/documents/${documentId}/download?token=${token || ''}`;
  },
};

