/**
 * Transcription service — hybrid pipeline:
 *
 * 1. YouTube → `youtube-transcript` (fetches YouTube's caption track directly).
 *    Pure HTTP — works on Vercel, no shell/ffmpeg/model needed.
 * 2. Fallback → Deepgram API (configured via Integrations module).
 *    - URL mode: works for platforms that serve direct media
 *    - File upload mode: used by the local pipeline when a downloader is available
 * 3. Final fallback → local yt-dlp + Whisper (dev/VPS only, not Vercel).
 */

import { prisma } from '@/lib/db';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  title: string;
  duration: number | null;
  language: string;
  text: string;
  segments: TranscriptionSegment[];
}

const DEEPGRAM_BASE = 'https://api.deepgram.com/v1/listen';

/**
 * Fetch the Deepgram config for a user from the integration settings.
 * Returns { apiKey, model } or null if not configured.
 */
export async function getDeepgramConfig(userId: string): Promise<{ apiKey: string; model: string } | null> {
  try {
    const integration = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'deepgram' } },
    });

    if (integration?.enabled && integration.config) {
      const config = JSON.parse(integration.config);
      const model = config.model || 'nova-2';

      if (config.apiKeyId) {
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { id: config.apiKeyId },
        });
        if (apiKeyRecord && apiKeyRecord.serverEncryptedKey && apiKeyRecord.serverIv) {
          const { decryptApiKey } = await import('@/lib/api-key-crypto');
          const apiKey = decryptApiKey(apiKeyRecord.serverEncryptedKey, apiKeyRecord.serverIv);
          return { apiKey, model };
        }
      }
    }
  } catch {
    // Fall through to env fallback
  }

  if (process.env.DEEPGRAM_API_KEY) {
    return {
      apiKey: process.env.DEEPGRAM_API_KEY,
      model: process.env.DEEPGRAM_MODEL || 'nova-2',
    };
  }

  return null;
}

/** Extract a YouTube video ID from any YouTube URL format. */
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Transcribe a YouTube video via the youtube-transcript package.
 * Works on Vercel (pure HTTP — fetches YouTube's caption track).
 * Returns null if captions aren't available.
 */
export async function transcribeYoutube(url: string): Promise<TranscriptionResult | null> {
  const videoId = extractYoutubeId(url);
  if (!videoId) return null;

  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    // Use the youtu.be format — the short URL format is what the package handles reliably
    const transcript = await YoutubeTranscript.fetchTranscript(`https://youtu.be/${videoId}`);

    if (!transcript || transcript.length === 0) return null;

    const text = transcript.map((t: any) => t.text).join(' ').trim();
    if (!text) return null;

    const segments: TranscriptionSegment[] = transcript.map((t: any) => ({
      start: t.offset / 1000,
      end: (t.offset + t.duration) / 1000,
      text: t.text.trim(),
    }));

    return {
      title: `YouTube video ${videoId}`,
      duration: null,
      language: 'en',
      text,
      segments,
    };
  } catch {
    return null;
  }
}

/**
 * Transcribe a media URL via Deepgram (URL mode).
 * Returns null if the API is not configured.
 * NOTE: YouTube/Instagram often serve HTML to Deepgram's downloader and fail.
 */
export async function transcribeDeepgramUrl(url: string, userId?: string): Promise<TranscriptionResult | null> {
  const config = userId ? await getDeepgramConfig(userId) : null;
  const apiKey = config?.apiKey || process.env.DEEPGRAM_API_KEY;
  const model = config?.model || 'nova-2';
  if (!apiKey) return null;

  const params = new URLSearchParams({
    model,
    timestamps: 'true',
    punctuate: 'true',
    utterances: 'true',
    smart_format: 'true',
    diarize: 'false',
  });

  const res = await fetch(`${DEEPGRAM_BASE}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return parseDeepgramResponse(data, url);
}

/**
 * Transcribe an audio buffer via Deepgram (file upload mode).
 * Works for any audio — requires a downloader to produce the file first.
 */
export async function transcribeDeepgramAudio(
  audioBuffer: Buffer,
  mimeType: string,
  userId?: string,
): Promise<TranscriptionResult | null> {
  const config = userId ? await getDeepgramConfig(userId) : null;
  const apiKey = config?.apiKey || process.env.DEEPGRAM_API_KEY;
  const model = config?.model || 'nova-2';
  if (!apiKey) return null;

  const params = new URLSearchParams({
    model,
    timestamps: 'true',
    punctuate: 'true',
    utterances: 'true',
    smart_format: 'true',
    diarize: 'false',
  });

  const res = await fetch(`${DEEPGRAM_BASE}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType || 'audio/wav',
      'Authorization': `Token ${apiKey}`,
    },
    body: new Uint8Array(audioBuffer),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return parseDeepgramResponse(data, 'audio upload');
}

/** Parse the Deepgram response into our standard format. */
function parseDeepgramResponse(data: any, url: string): TranscriptionResult {
  const channel = data?.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];
  const transcript: string = alt?.transcript || '';

  const words: Array<{ word: string; start: number; end: number }> =
    alt?.words?.map((w: any) => ({
      word: w.word || '',
      start: w.start ?? 0,
      end: w.end ?? 0,
    })) || [];

  const segments: TranscriptionSegment[] = buildSegments(words, transcript);
  const duration = data?.metadata?.duration ?? null;

  return {
    title: extractTitle(url, data?.metadata),
    duration: typeof duration === 'number' ? duration : null,
    language: channel?.detected_language || 'en',
    text: transcript,
    segments,
  };
}

/** Group words into segments (chunks of ~10 words). */
function buildSegments(words: Array<{ word: string; start: number; end: number }>, fullText: string): TranscriptionSegment[] {
  if (words.length === 0) {
    return fullText ? [{ start: 0, end: 0, text: fullText }] : [];
  }

  const segments: TranscriptionSegment[] = [];
  let current: string[] = [];
  let start = words[0].start;

  for (const w of words) {
    current.push(w.word);
    const lastEnd = w.end;
    if (current.length >= 10) {
      segments.push({ start, end: lastEnd, text: current.join(' ').trim() });
      current = [];
      start = lastEnd;
    }
  }
  if (current.length > 0) {
    segments.push({ start, end: words[words.length - 1].end, text: current.join(' ').trim() });
  }
  return segments;
}

function extractTitle(url: string, metadata: any): string {
  if (metadata?.title) return metadata.title;
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return `Video from ${host}`;
  } catch {
    return 'Video transcription';
  }
}
