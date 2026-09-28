import { SERVICES_CONFIG } from './services.config';

describe('gateway response cache rules', () => {
  const search = SERVICES_CONFIG.find((s) => s.name === 'search-service')!;

  it('never caches the ranked search (A/B assignment and counting happen per request)', () => {
    expect(search.cacheableRoutes!.test('/search')).toBe(false);
    expect(search.cacheableRoutes!.test('/search/')).toBe(false);
  });

  it('still caches anonymous helper lookups', () => {
    expect(search.cacheableRoutes!.test('/search/suggestions')).toBe(true);
    expect(search.cacheableRoutes!.test('/search/autocomplete')).toBe(true);
  });
});
