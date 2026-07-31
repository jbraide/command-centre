/**
 * API-based transcription via Deepgram.
 *
 * Deepgram accepts a media URL directly — it handles the download and
 * transcription server-side, so this works on Vercel (no shell, no ffmpeg,
 * no local Whisper model needed).
 *
 * Supported: YouTube, Instagram, TikTok, Facebook, Twitter/X, Vimeo, audio files, etc.
 *
 * Setup:
 *   DEEPGRAM_API_KEY=your_key    (https://console.deepgram.com)
 *   Optionally: DEEPGRAM_MODEL=nova-3 (default: nova-2 — good balance of speed/accuracy)
 *
 * Fallback behavior:
 *   - If DEEPGRAM_API_KEY is not set, the route falls back to the local
 *     yt-dlp + Whisper pipeline (works on a VPS/desktop, not on Vercel).
 */

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

function getConfig() {
  return {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
    model: process.env.DEEPGRAM_MODEL || 'nova-2',
  };
}

/**
 * Transcribe a media URL via Deepgram.
 * Returns null if the API is not configured (caller falls back to local pipeline).
 */
export async function transcribeUrl(url: string): Promise<TranscriptionResult | null> {
  const { apiKey, model } = getConfig();
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
    signal: AbortSignal.timeout(300_000), // 5 min — long videos
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  const channel = data?.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];
  const transcript: string = alt?.transcript || '';

  // Build segments from word-level timestamps (group by ~sentence/utterance)
  const words: Array<{ word: string; start: number; end: number }> =
    alt?.words?.map((w: any) => ({
      word: w.word || '',
      start: w.start ?? 0,
      end: w.end ?? 0,
    })) || [];

  const segments: TranscriptionSegment[] = buildSegments(words, transcript);
  const duration = data?.metadata?.duration ?? null;
  const title = extractTitle(url, data?.metadata);

  return {
    title,
    duration: typeof duration === 'number' ? duration : null,
    language: channel?.detected_language || 'en',
    text: transcript,
    segments,
  };
}

/** Group words into segments (chunks of ~8 words or on long pauses). */
function buildSegments(words: Array<{ word: string; start: number; end: number }>, fullText: string): TranscriptionSegment[] {
  if (words.length === 0) {
    return fullText
      ? [{ start: 0, end: 0, text: fullText }]
      : [];
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

/** Best-effort title: Deepgram doesn't always return one — derive from URL host. */
function extractTitle(url: string, metadata: any): string {
  if (metadata?.title) return metadata.title;
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return `Video from ${host}`;
  } catch {
    return 'Video transcription';
  }
}
