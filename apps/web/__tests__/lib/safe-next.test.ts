import { safeNext } from '@/lib/safe-next';

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/listings/abc?x=1')).toBe('/listings/abc?x=1');
  });

  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/\t/evil.com', '/\n/evil.com', '/\r//evil.com', '/ /evil.com', '/\u0000/evil.com'])('rejects %p', (raw) => {
    expect(safeNext(raw)).toBe('/');
  });
});
