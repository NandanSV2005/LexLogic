import { apiClient, API_BASE_URL } from './client';
import { DocumentItem, DocumentShareItem, DocumentSharePermission, PrivacySummary } from '../types';

export const documentsApi = {
  uploadDocument: async (
    title: string,
    file: File,
    requestId?: number,
    shareWithProviderId?: number,
    permission?: string
  ): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);
    if (requestId) {
      formData.append('request_id', requestId.toString());
    }
    if (shareWithProviderId) {
      formData.append('share_with_provider_id', shareWithProviderId.toString());
    }
    if (permission) {
      formData.append('permission', permission);
    }

    const response = await apiClient.post<DocumentItem>('/api/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  listMyDocuments: async (): Promise<DocumentItem[]> => {
    const response = await apiClient.get<DocumentItem[]>('/api/documents/me');
    return response.data;
  },

  listSharedWithMe: async (): Promise<DocumentItem[]> => {
    const response = await apiClient.get<DocumentItem[]>('/api/documents/me');
    return response.data;
  },

  shareDocument: async (
    documentId: number,
    providerId: number,
    permission: DocumentSharePermission = DocumentSharePermission.VIEW
  ): Promise<DocumentShareItem> => {
    const response = await apiClient.post<DocumentShareItem>(`/api/documents/${documentId}/share`, {
      provider_id: providerId,
      permission,
    });
    return response.data;
  },

  revokeDocument: async (documentId: number, providerId: number): Promise<DocumentShareItem> => {
    const response = await apiClient.post<DocumentShareItem>(`/api/documents/${documentId}/revoke`, {
      provider_id: providerId,
    });
    return response.data;
  },

  getPrivacySummary: async (requestId: number): Promise<PrivacySummary> => {
    const response = await apiClient.get<PrivacySummary>(`/api/documents/privacy-summary/${requestId}`);
    return response.data;
  },

  analyzeDocument: async (documentId: number): Promise<any> => {
    const response = await apiClient.post(`/api/documents/${documentId}/analyze`);
    return response.data;
  },

  getDocumentViewUrl: (documentId: number): string => {
    return `${API_BASE_URL}/api/documents/${documentId}?download=false`;
  },

  getDocumentDownloadUrl: (documentId: number): string => {
    return `${API_BASE_URL}/api/documents/${documentId}?download=true`;
  },
};
