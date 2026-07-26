import { NextRequest, NextResponse } from 'next/server';
import { downloadAudio, transcribeAudio, cleanup } from '@/lib/transcriber';

export async function POST(req: NextRequest) {
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
    const download = downloadAudio(url, cookies_file || undefined);
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
  } catch (error: any) {
    console.error('Transcription error:', error.message);

    // Determine a sensible HTTP status
    const msg = error.message || 'Transcription failed';
    const status =
      msg.toLowerCase().includes('download') ||
      msg.toLowerCase().includes('url') ||
      msg.toLowerCase().includes('audio file')
        ? 400
        : 500;

    return NextResponse.json({ error: msg, detail: msg }, { status });
  } finally {
    if (workdir) {
      cleanup(workdir);
    }
  }
}
