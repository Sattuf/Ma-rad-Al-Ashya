import { searchApi } from '@/lib/api/search';
import { api } from '@/lib/api/auth';
import { listingsApi } from '@/lib/api/listings';

jest.mock('../../src/lib/api/auth', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../src/lib/api/listings', () => ({ listingsApi: { getListings: jest.fn() } }));

const listing = (id: string, status = 'active') => ({ id, status, title: id, images: [] }) as any;
const dbPage = (data: any[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, lastPage: 1 } });

describe('searchApi.page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the ranking order and drops listings that stopped being active', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { ids: ['c', 'a', 'b'], total: 3, page: 1, limit: 20, variant: 'B' } });
    (listingsApi.getListings as jest.Mock).mockResolvedValue(dbPage([listing('a'), listing('b', 'sold'), listing('c')]));

    const page = await searchApi.page({ search: 'جوال' });

    expect(page.variant).toBe('B');
    expect(page.data.map((l) => l.id)).toEqual(['c', 'a']);
    expect(api.get).toHaveBeenCalledWith('/search', expect.objectContaining({ params: expect.objectContaining({ q: 'جوال', session_id: expect.any(String) }) }));
  });

  it('falls back to the database when search is down, outside the experiment', async () => {
    (api.get as jest.Mock).mockRejectedValue({ response: { status: 503 } });
    (listingsApi.getListings as jest.Mock).mockResolvedValue(dbPage([listing('a')]));

    const page = await searchApi.page({ search: 'جوال' });

    expect(page.variant).toBeNull();
    expect(listingsApi.getListings).toHaveBeenCalledWith(expect.objectContaining({ search: 'جوال' }));
  });

  it('does not hide real request errors behind the fallback', async () => {
    (api.get as jest.Mock).mockRejectedValue({ response: { status: 400 } });
    await expect(searchApi.page({ search: 'x' })).rejects.toEqual({ response: { status: 400 } });
  });

  it('browsing without text never touches the experiment', async () => {
    (listingsApi.getListings as jest.Mock).mockResolvedValue(dbPage([listing('a')]));
    const page = await searchApi.page({ categoryId: 'c1' });
    expect(api.get).not.toHaveBeenCalled();
    expect(page.variant).toBeNull();
  });
});
