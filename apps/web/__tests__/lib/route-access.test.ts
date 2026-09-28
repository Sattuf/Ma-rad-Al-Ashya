import { isAuthPage, requiresAuth } from '@/lib/route-access';

describe('route access', () => {
  it.each(['/', '/listings', '/listings/abc', '/search', '/map', '/explore', '/users/u1'])('%s is public', (p) => {
    expect(requiresAuth(p)).toBe(false);
  });

  it.each(['/admin', '/admin/reports', '/my-listings', '/messages', '/profile/edit', '/favorites', '/transactions/t1', '/listings/create', '/listings/abc/edit', '/listings/abc/promote'])(
    '%s requires a session',
    (p) => {
      expect(requiresAuth(p)).toBe(true);
    },
  );

  it('does not treat look-alike paths as protected or auth pages', () => {
    expect(requiresAuth('/administrator')).toBe(false);
    expect(isAuthPage('/login-help')).toBe(false);
    expect(isAuthPage('/login')).toBe(true);
  });
});
