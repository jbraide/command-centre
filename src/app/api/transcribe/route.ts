import { NextRequest, NextResponse } from 'next/server';
import { downloadAudio, transcribeAudio, cleanup } from '@/lib/transcriber';
import { transcribeUrl } from '@/lib/transcription-api';
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

    // ── Preferred: API-based transcription (Vercel-compatible) ──────────
    // Deepgram handles download + transcription server-side. Works with
    // YouTube, Instagram, TikTok, Facebook, and more — no shell required.
    const apiResult = await transcribeUrl(url);
    if (apiResult) {
      return NextResponse.json(apiResult);
    }

    // ── Fallback: local yt-dlp + Whisper (VPS/desktop only) ─────────────
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
