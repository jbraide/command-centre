import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getR2Config,
  getObject,
  sanitizeObjectKey,
} from '@/lib/r2';

// GET /api/r2/object?key= — fetch an object (used for thumbnails, previews, downloads)
// Objects are proxied through a signed R2 request so they work even when the
// bucket is private.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawKey = request.nextUrl.searchParams.get('key');
  const key = rawKey ? sanitizeObjectKey(rawKey) : null;
  if (!key) {
    return NextResponse.json({ error: 'Invalid or missing key' }, { status: 400 });
  }

  const config = await getR2Config(session.user.id);
  if (!config) {
    return NextResponse.json(
      { error: 'Cloudflare R2 is not configured.' },
      { status: 400 }
    );
  }

  try {
    const objectRes = await getObject(config, key);
    if (!objectRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch object (${objectRes.status})` },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set(
      'content-type',
      objectRes.headers.get('content-type') || 'application/octet-stream'
    );
    const filename = key.split('/').pop()?.replace(/["\\]/g, '') || 'file';
    headers.set(
      'content-disposition',
      `inline; filename="${filename}"`
    );
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(objectRes.body, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch object';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
