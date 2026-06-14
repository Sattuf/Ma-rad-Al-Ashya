import { api } from './auth';

export interface VariantStats {
  total_searches: number;
  total_clicks: number;
  ctr: number;
}

export interface SearchQueryStat {
  query: string;
  count: number;
  date: string;
}

export interface TopListing {
  id: string;
  title: string;
  score: number;
  views: number;
  messages: number;
}

export interface RankingStats {
  variants: {
    A: VariantStats;
    B: VariantStats;
  };
  ctr_over_time: {
    date: string;
    variant_a_ctr: number;
    variant_b_ctr: number;
  }[];
  top_listings: TopListing[];
  zero_results_queries: string[];
}

export const rankingApi = {
  getRankingStats: async (): Promise<RankingStats> => {
    const response = await api.get('/search/ranking/stats');
    return response.data;
  }
};
