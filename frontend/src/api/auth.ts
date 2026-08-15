import { apiClient } from './client';
import { AuthResponse, User, UserRole } from '../types';

export const authApi = {
  register: async (email: string, password: string, role: UserRole): Promise<User> => {
    const response = await apiClient.post<User>('/api/auth/register', {
      email,
      password,
      role,
    });
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/auth/me');
    return response.data;
  },
};
