import { NextRequest, NextResponse } from 'next/server';
import { downloadAudio, transcribeAudio, cleanup } from '@/lib/transcriber';
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

    // Step 1: download audio via yt-dlp + ffmpeg
    const download = await downloadAudio(url, cookies_file || undefined);
    workdir = download.workdir;

    // Step 2: transcribe via Xenova/Transformers (pure JS Whisper)
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

    // Return generic error, log details server-side only
    const status = 500;
    return NextResponse.json({ error: 'Transcription failed' }, { status });
  } finally {
    if (workdir) {
      cleanup(workdir);
    }
  }
}
