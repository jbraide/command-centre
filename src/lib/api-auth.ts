/**
 * API authentication utility.
 * Supports two auth methods:
 *   1. Browser session cookie (via Auth.js) — used by the dashboard UI
 *   2. Bearer JWT token (via /api/auth/login) — used by curl, AI agent, external tools
 *
 * Usage:
 *   # Get a token:
 *   curl -X POST http://localhost:5522/api/auth/login \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"your@email.com","password":"yourpass"}'
 *
 *   # Use the token:
 *   curl -H "Authorization: Bearer <token>" http://localhost:5522/api/personas
 */

import { auth } from './auth';
import { prisma } from './db';

export interface AuthResult {
  user: { id: string; email: string; name: string | null } | null;
}

/**
 * Get the authenticated session, checking both cookie-based auth (browser)
 * and Bearer JWT token (API clients).
 */
export async function getServerAuth(request?: Request): Promise<AuthResult> {
  // 1. Try normal cookie-based session (browser)
  const session = await auth();
  if (session?.user?.id) {
    return { user: { id: session.user.id, email: session.user.email!, name: session.user.name } };
  }

  // 2. Try Bearer JWT token from Authorization header
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token) {
        try {
          const { jwtVerify } = await import('jose');
          const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'fallback-secret-change-me');
          const { payload } = await jwtVerify(token, secret);
          if (payload.id || payload.sub) {
            const userId = (payload.id || payload.sub) as string;
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, email: true, name: true },
            });
            if (user) return { user };
          }
        } catch {
          // Invalid or expired token — fall through to unauthorized
        }
      }
    }
  }

  return { user: null };
}
