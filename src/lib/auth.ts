import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

const nextAuthResult = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) return null;

          const passwordMatch = await bcrypt.compare(password, user.password);
          if (!passwordMatch) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuthResult;

interface AuthSession {
  user: { id: string; email: string | null; name: string | null } | null;
}

/**
 * Enhanced auth() that supports BOTH:
 *   1. Browser session cookies (via Auth.js)
 *   2. Bearer JWT token via Authorization header (for curl, API clients)
 */
export async function auth(): Promise<AuthSession | null> {
  // 1. Try NextAuth's cookie-based auth
  const session = await nextAuthResult.auth();
  if (session?.user?.id) {
    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
      },
    };
  }

  // 2. Try Bearer JWT token from Authorization header
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token) {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'fallback-secret-change-me');
        const { payload } = await jwtVerify(token, secret);

        const userId = (payload.id || payload.sub) as string;
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true },
          });

          if (user) {
            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
              },
            };
          }
        }
      }
    }
  } catch {
    // headers() may throw during build time — ignore
  }

  return null;
}
