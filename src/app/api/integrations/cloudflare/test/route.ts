import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listBuckets } from '@/lib/r2';

// POST /api/integrations/cloudflare/test — verify R2 credentials by listing buckets
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, accessKeyId, secretAccessKey, endpointUrl } = body as {
      accountId?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      endpointUrl?: string;
    };

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account ID, Access Key ID, and Secret Access Key are required.',
        },
        { status: 200 }
      );
    }

    const buckets = await listBuckets({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName: '',
      endpointUrl: endpointUrl || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Connected to Cloudflare R2 — found ${buckets.length} bucket${
        buckets.length === 1 ? '' : 's'
      }.`,
      buckets,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to connect to Cloudflare R2';
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}
