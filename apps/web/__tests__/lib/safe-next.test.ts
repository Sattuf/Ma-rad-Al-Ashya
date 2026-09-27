import { safeNext } from '@/lib/safe-next';

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/listings/abc?x=1')).toBe('/listings/abc?x=1');
  });

  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'])('rejects %p', (raw) => {
    expect(safeNext(raw)).toBe('/');
  });
});
