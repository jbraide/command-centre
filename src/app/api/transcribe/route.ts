import { NextRequest, NextResponse } from 'next/server';
import { downloadAudio, transcribeAudio, cleanup } from '@/lib/transcriber';
import { transcribeYoutube, transcribeDeepgramUrl } from '@/lib/transcription-api';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let workdir: string | undefined;

  try {
    const body = await req.json();
    const { url, model_size, cookies_file } = body as {
      url?: string;
      model_size?: string;
      cookies_file?: string | null;
    };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "url" field' },
        { status: 400 }
      );
    }

    // ── 1. YouTube → caption track (Vercel-ready, pure HTTP) ────────────
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const ytResult = await transcribeYoutube(url);
      if (ytResult) {
        return NextResponse.json(ytResult);
      }
      // No captions → fall through to Deepgram / local
    }

    // ── 2. Deepgram URL mode (works for platforms that serve direct media) ──
    try {
      const dgResult = await transcribeDeepgramUrl(url, session.user.id);
      if (dgResult) {
        return NextResponse.json(dgResult);
      }
    } catch {
      // Deepgram URL mode failed (YouTube/Instagram often serve HTML) — fall through
    }

    // ── 3. Local yt-dlp + Whisper (dev/VPS only) ─────────────────────────
    const download = await downloadAudio(url, cookies_file || undefined);
    workdir = download.workdir;

    const transcript = await transcribeAudio(download.audioPath, model_size || 'tiny');

    return NextResponse.json({
      title: download.title,
      duration: download.duration,
      language: transcript.language,
      text: transcript.text,
      segments: transcript.segments,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  } finally {
    if (workdir) {
      cleanup(workdir);
    }
  }
}
