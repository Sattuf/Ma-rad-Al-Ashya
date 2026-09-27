import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthPage, requiresAuth } from '@/lib/route-access';
import { safeNext } from '@/lib/safe-next';

/** Reads the (unverified) JWT payload. Used only to route the UI; the API re-checks everything. */
function jwtRole(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role;
  } catch {
    return undefined;
  }
}

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

  if (token && pathname.startsWith('/admin')) {
    const role = jwtRole(token);
    if (role !== undefined && role !== 'admin') return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
