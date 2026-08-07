import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  // API routes authenticate themselves and return proper 401 JSON when the
  // session is missing or expired — never redirect them to the login page.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // JWT session check for page requests.
  // Uses getToken (jose) instead of the auth() helper: auth() imports Prisma
  // and bcryptjs, which can't run in the Edge runtime and would silently
  // disable this middleware.
  const secureCookie = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || '').startsWith(
    'https://'
  );
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || 'fallback-secret-change-me',
    secureCookie,
  });

  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set(
      'callbackUrl',
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)',
  ],
};
