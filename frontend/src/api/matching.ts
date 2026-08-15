import { apiClient } from './client';
import { MatchResponse } from '../types';

export interface MatchQueryInput {
  request_id: number;
  min_match_score?: number;
}

export const matchingApi = {
  matchProviders: async (requestId: number, minMatchScore: number = 0.0): Promise<MatchResponse> => {
    const response = await apiClient.post<MatchResponse>('/api/matching/providers', {
      request_id: requestId,
      min_match_score: minMatchScore,
    });
    return response.data;
  },
};
