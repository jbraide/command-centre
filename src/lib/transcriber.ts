import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

const PROJECT_ROOT = process.cwd();

function ffmpegDir() {
  return path.join(PROJECT_ROOT, 'instagram-transcriber');
}

function ytDlpBin() {
  return path.join(PROJECT_ROOT, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp');
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface DownloadResult {
  audioPath: string;
  title: string;
  duration: number | null;
  workdir: string;
}

export interface TranscriptResult {
  text: string;
  language: string;
  segments: Segment[];
}

export async function downloadAudio(url: string, cookiesFile?: string): Promise<DownloadResult> {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'igreel_'));
  const outTemplate = path.join(workdir, crypto.randomUUID() + '.%(ext)s');

  const args: string[] = [
    '--ffmpeg-location', ffmpegDir(),
    '--extract-audio',
    '--audio-format', 'wav',
    '--postprocessor-args', '-ar 16000 -ac 1',
    '--output', outTemplate,
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    '--print', 'after_move:%(title)s\t%(duration)s',
  ];

  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }

  args.push(url);

  try {
    const cmd = '"' + ytDlpBin() + '" ' + args.map(a => JSON.stringify(a)).join(' ');
    const { stdout } = await execAsync(cmd, {
      encoding: 'utf-8',
      timeout: 600000,
      maxBuffer: 100 * 1024 * 1024,
      env: { ...process.env, SSL_CERT_FILE: '/usr/lib/ssl/cert.pem' },
    });

    const files = fs.readdirSync(workdir);
    const wavFile = files.find((f) => f.endsWith('.wav'));
    if (!wavFile) {
      throw new Error('No audio file produced by yt-dlp');
    }

    const audioPath = path.join(workdir, wavFile);
    const trimmed = stdout.trim();
    const parts = trimmed.split('\t');
    const title = parts[0] || 'Untitled';
    const duration = parts[1] ? parseFloat(parts[1]) : null;

    return { audioPath, title, duration, workdir };
  } catch (err: any) {
    cleanup(workdir);
    throw new Error('Download failed: ' + (err.stderr || err.message));
  }
}

// Read a WAV file and return the raw PCM samples as a Float32Array
function readWavAsFloat32(filePath: string): Float32Array {
  const buffer = fs.readFileSync(filePath);
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Read number of channels and sample rate from header
  const numChannels = dataView.getUint16(22, true);
  const bitsPerSample = dataView.getUint16(34, true);

  // Walk chunks to find the 'data' chunk (handles extra chunks like 'fact' or 'LIST')
  let dataStart = 0;
  let dataSize = 0;
  let offset = 12; // Skip RIFF header (12 bytes)
  while (offset + 8 < buffer.length) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(offset), dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2), dataView.getUint8(offset + 3)
    );
    const chunkSize = dataView.getUint32(offset + 4, true);
    if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (!dataStart || !dataSize) {
    throw new Error('Could not find data chunk in WAV file');
  }

  const sampleCount = dataSize / (bitsPerSample / 8) / numChannels;
  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    let sample = 0;
    const byteOffset = dataStart + i * numChannels * (bitsPerSample / 8);

    if (bitsPerSample === 16) {
      sample = dataView.getInt16(byteOffset, true) / 32768;
    } else if (bitsPerSample === 32) {
      sample = dataView.getFloat32(byteOffset, true);
    } else if (bitsPerSample === 8) {
      sample = (dataView.getUint8(byteOffset) - 128) / 128;
    }

    samples[i] = Math.max(-1, Math.min(1, sample));
  }

  return samples;
}

let transcriberInstance: any = null;

async function getTranscriber(modelSize: string = 'tiny') {
  if (!transcriberInstance) {
    const { pipeline } = await import('@xenova/transformers');
    const modelName = 'Xenova/whisper-' + modelSize;
    transcriberInstance = await pipeline('automatic-speech-recognition', modelName, {
      quantized: true,
    });
  }
  return transcriberInstance;
}

export async function transcribeAudio(
  audioPath: string,
  modelSize: string = 'tiny'
): Promise<TranscriptResult> {
  try {
    const audioData = readWavAsFloat32(audioPath);

    // Check if the audio actually has data (Instagram reels often fail silently)
    if (audioData.length < 100) {
      throw new Error(
        'Downloaded audio contains no speech data. Instagram reels require authentication cookies. ' +
        'Try using a YouTube URL, or provide Instagram cookies via the cookies file option.'
      );
    }

    const transcriber = await getTranscriber(modelSize);

    const result = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const chunks: any[] = (result as any).chunks || [];
    const segments: Segment[] = chunks.map((chunk: any) => ({
      start: chunk.timestamp[0] || 0,
      end: chunk.timestamp[1] || 0,
      text: (chunk.text || '').trim(),
    }));

    return {
      text: (result as any).text || '',
      language: 'en',
      segments,
    };
  } catch (err: any) {
    throw new Error('Transcription failed: ' + (err.message || err));
  }
}

export function cleanup(workdir: string): void {
  try {
    fs.rmSync(workdir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
