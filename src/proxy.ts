import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Auth.js v5 uses "authjs.session-token" (not "next-auth.session-token")
  const hasSession =
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-authjs.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token');

  if (!hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)',
  ],
};
