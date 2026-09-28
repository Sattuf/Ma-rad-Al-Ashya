import { api } from './auth';

export interface VariantStats {
  searches: number;
  clicks: number;
  /** clicks / searches, 0–1 */
  ctr: number;
}

export interface RankingStats {
  variants: { A: VariantStats; B: VariantStats };
  /** Most clicked listings from search results, last 30 days (ids; titles are resolved separately). */
  topClicked: Array<{ id: string; clicks: number }>;
  /** Searches that returned nothing, last 30 days: demand the catalogue does not meet. */
  zeroResultQueries: Array<{ query: string; count: number }>;
}

interface ServerVariant {
  total_searches: number;
  total_clicks: number;
  ctr: number;
}

/** GET /search/ranking/stats (search-service, admin only, cached 60s). */
export const rankingApi = {
  getRankingStats: async (): Promise<RankingStats> => {
    const { data } = await api.get('/search/ranking/stats');
    const v = (s?: ServerVariant): VariantStats => ({ searches: s?.total_searches ?? 0, clicks: s?.total_clicks ?? 0, ctr: s?.ctr ?? 0 });
    return {
      variants: { A: v(data.ab_test?.variant_a), B: v(data.ab_test?.variant_b) },
      topClicked: data.top_ranked_listings ?? [],
      zeroResultQueries: data.zero_results_queries ?? [],
    };
  },
};

/**
 * Two-proportion z-test on click-through rates. A "winner" is declared only with enough
 * traffic (≥ 100 searches per variant) and |z| ≥ 1.96 (≈ 95% confidence); otherwise the
 * difference may be noise and the page says so.
 */
export function compareVariants(a: VariantStats, b: VariantStats): { winner: 'A' | 'B' | null; reason: 'insufficient-data' | 'not-significant' | 'significant'; z: number } {
  if (a.searches < 100 || b.searches < 100) return { winner: null, reason: 'insufficient-data', z: 0 };
  const pooled = (a.clicks + b.clicks) / (a.searches + b.searches);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.searches + 1 / b.searches));
  const z = se === 0 ? 0 : (a.ctr - b.ctr) / se;
  if (Math.abs(z) < 1.96) return { winner: null, reason: 'not-significant', z };
  return { winner: z > 0 ? 'A' : 'B', reason: 'significant', z };
}
