import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthPage, requiresAuth } from '@/lib/route-access';
import { safeNext } from '@/lib/safe-next';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get('refresh_token')?.value || request.cookies.get('access_token')?.value;

  if (!token && requiresAuth(pathname)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (token && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get('next')), request.url));
  }

  // Admin pages need a session here; the admin role is checked by the admin layout (from
  // the restored session) and enforced by AdminGuard on every admin API. The proxy cannot
  // check it: only the refresh token is a cookie, and it carries no role.

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
