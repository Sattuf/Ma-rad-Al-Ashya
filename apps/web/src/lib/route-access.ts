/**
 * Which pages need a signed-in user. Browsing (home, listings, search, map, public
 * profiles) stays open to guests: a marketplace that hides its listings behind a login
 * loses buyers and search engines. Real authorization is always enforced by the API.
 */
const PROTECTED: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/my-listings(\/|$)/,
  /^\/favorites(\/|$)/,
  /^\/messages(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/transactions(\/|$)/,
  /^\/listings\/create(\/|$)/,
  /^\/listings\/[^/]+\/(edit|promote)(\/|$)/,
];

const AUTH_PAGES = ['/login', '/register', '/verify-otp'];

export const requiresAuth = (pathname: string) => PROTECTED.some((rx) => rx.test(pathname));

export const isAuthPage = (pathname: string) => AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
