import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getR2Config,
  getPublicUrl,
  listObjects,
  putObject,
  deleteObject,
  sanitizeObjectKey,
} from '@/lib/r2';

// GET /api/r2/files?prefix= — list objects in the R2 bucket
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getR2Config(session.user.id);
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  const prefix = request.nextUrl.searchParams.get('prefix') ?? '';

  try {
    const objects = await listObjects(config, { prefix: prefix || undefined });
    return NextResponse.json({
      configured: true,
      publicBaseUrl: config.publicBaseUrl ?? null,
      objects,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list objects';
    return NextResponse.json(
      { configured: true, error: message },
      { status: 502 }
    );
  }
}

// POST /api/r2/files — upload a file (raw body, object key in x-file-key header)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawKey = request.headers.get('x-file-key');
  const key = rawKey ? sanitizeObjectKey(rawKey) : null;
  if (!key) {
    return NextResponse.json(
      { error: 'Invalid or missing file key' },
      { status: 400 }
    );
  }

  const config = await getR2Config(session.user.id);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Cloudflare R2 is not configured. Set it up in Integrations → Cloudflare first.',
      },
      { status: 400 }
    );
  }

  try {
    const body = Buffer.from(await request.arrayBuffer());
    const contentType =
      request.headers.get('content-type') || 'application/octet-stream';
    await putObject(config, { key, body, contentType });
    return NextResponse.json({ key, url: getPublicUrl(config, key) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// DELETE /api/r2/files?key= — delete an object from the bucket
export async function DELETE(request: NextRequest) {
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
    await deleteObject(config, key);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
