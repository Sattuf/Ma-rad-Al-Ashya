import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that are public
  const publicPaths = ['/login', '/register', '/verify-otp'];
  
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Skip middleware for Next.js internal requests, API routes, and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for token in cookies
  const token = request.cookies.get('refresh_token')?.value;

  if (!token && !isPublicPath) {
    // Redirect to login if accessing protected route without token
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  if (token && isPublicPath) {
    // Redirect to home if accessing auth pages with token
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
