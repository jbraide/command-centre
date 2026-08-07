'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a login URL that remembers where the user was, so they land back on
 * the same page after signing in again.
 */
export function buildLoginUrl(pathname: string, search: string): string {
  const callback = encodeURIComponent(pathname + search);
  return `/login?callbackUrl=${callback}`;
}

/* ------------------------------------------------------------------ */
/*  Session guard                                                      */
/* ------------------------------------------------------------------ */

/**
 * Guards dashboard pages: when the NextAuth session becomes unauthenticated
 * (expired, cleared, or signed out in another tab), redirect to the login page
 * instead of leaving the user staring at a broken dashboard full of errors.
 */
export function AuthSessionGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(buildLoginUrl(pathname, window.location.search));
    }
  }, [status, pathname, router]);

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">
          Session expired — redirecting to sign in…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  401 interceptor                                                    */
/* ------------------------------------------------------------------ */

let installed = false;
let redirectInFlight = false;

/**
 * Patch window.fetch so a 401 from one of our API routes is treated as a
 * session expiry: the user is redirected to /login (with a callback URL) so
 * they can sign back in. The original response is still returned to the
 * caller, so existing error handling keeps working.
 *
 * /api/auth/* endpoints are excluded — they legitimately return 401 for bad
 * credentials (e.g. the custom login route) and must not trigger a redirect.
 */
export function installAuthInterceptor(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    if (
      response.status === 401 &&
      !redirectInFlight &&
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')
    ) {
      const raw =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input?.url ?? '';
      let path = raw;
      try {
        path = new URL(raw, window.location.origin).pathname;
      } catch {}

      if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
        redirectInFlight = true;
        window.location.assign(
          buildLoginUrl(window.location.pathname, window.location.search)
        );
      }
    }

    return response;
  };
}
