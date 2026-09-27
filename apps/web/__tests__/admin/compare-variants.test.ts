import { compareVariants } from '@/lib/api/ranking';

const v = (searches: number, clicks: number) => ({ searches, clicks, ctr: searches ? clicks / searches : 0 });

describe('compareVariants', () => {
  it('refuses to pick a winner on little traffic, however big the gap', () => {
    expect(compareVariants(v(40, 30), v(40, 2))).toMatchObject({ winner: null, reason: 'insufficient-data' });
  });

  it('does not call a small difference on real traffic', () => {
    expect(compareVariants(v(1000, 110), v(1000, 100))).toMatchObject({ winner: null, reason: 'not-significant' });
  });

  it('names the winner when the difference is significant', () => {
    expect(compareVariants(v(2000, 300), v(2000, 200))).toMatchObject({ winner: 'A', reason: 'significant' });
    expect(compareVariants(v(2000, 200), v(2000, 300)).winner).toBe('B');
  });
});
