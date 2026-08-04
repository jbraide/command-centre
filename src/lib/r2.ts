/**
 * Cloudflare R2 object storage client.
 *
 * R2 exposes an S3-compatible API, so we implement the small slice of the S3
 * API we need (PutObject, GetObject, DeleteObject, ListObjectsV2, ListBuckets)
 * with AWS Signature Version 4 signing — no AWS SDK dependency required.
 *
 * Credentials are split across:
 *   - the integration config  — account ID, access key ID, bucket name,
 *     endpoint / public base URL (all non-secret identifiers)
 *   - the API Key Store       — the R2 secret access key (server-side encrypted)
 */

import { createHash, createHmac } from 'node:crypto';
import { prisma } from '@/lib/db';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Optional custom S3 endpoint (defaults to <accountId>.r2.cloudflarestorage.com) */
  endpointUrl?: string;
  /** Optional public base URL (custom domain or pub-<hash>.r2.dev) for shareable links */
  publicBaseUrl?: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: string;
}

const S3_REGION = 'auto';
const S3_SERVICE = 's3';
const EMPTY_BUFFER = Buffer.alloc(0);

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

/**
 * Load the user's Cloudflare R2 configuration from their service
 * integration, decrypting the secret access key from the API Key Store.
 * Returns null when not configured, disabled, or incomplete.
 */
export async function getR2Config(userId: string): Promise<R2Config | null> {
  try {
    const integration = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'cloudflare' } },
    });

    if (!integration?.enabled) return null;

    const config = JSON.parse(integration.config) as Record<string, unknown>;
    const accountId = typeof config.accountId === 'string' ? config.accountId : '';
    const accessKeyId = typeof config.accessKeyId === 'string' ? config.accessKeyId : '';
    const bucketName = typeof config.bucketName === 'string' ? config.bucketName : '';
    if (!accountId || !accessKeyId || !bucketName) return null;

    // The secret access key lives in the API Key Store (server-side encrypted)
    let secretAccessKey: string | null = null;
    if (typeof config.apiKeyId === 'string' && config.apiKeyId) {
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: config.apiKeyId },
      });
      if (keyRecord?.serverEncryptedKey && keyRecord.serverIv) {
        const { decryptApiKey } = await import('@/lib/api-key-crypto');
        secretAccessKey = decryptApiKey(
          keyRecord.serverEncryptedKey,
          keyRecord.serverIv
        );
      }
    }
    if (!secretAccessKey) return null;

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      endpointUrl:
        typeof config.endpointUrl === 'string' && config.endpointUrl.trim()
          ? config.endpointUrl.trim()
          : undefined,
      publicBaseUrl:
        typeof config.publicBaseUrl === 'string' && config.publicBaseUrl.trim()
          ? config.publicBaseUrl.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Validate + normalize an object key before storing it.
 * Returns null when the key is unsafe (path traversal, control chars, too long).
 */
export function sanitizeObjectKey(key: string): string | null {
  const clean = key.replace(/^\/+/, '').trim();
  if (!clean || clean.length > 1024) return null;
  if (
    clean.split('/').some((segment) => segment === '..' || /[\x00-\x1f]/.test(segment))
  ) {
    return null;
  }
  return clean;
}

/** Public URL for a key when a public base URL is configured, otherwise null. */
export function getPublicUrl(config: R2Config, key: string): string | null {
  if (!config.publicBaseUrl) return null;
  const base = config.publicBaseUrl.replace(/\/+$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/* ------------------------------------------------------------------ */
/*  AWS Signature Version 4                                            */
/* ------------------------------------------------------------------ */

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/** RFC 3986 percent-encoding, which S3 requires (stricter than encodeURIComponent). */
function uriEncode(input: string, encodeSlash: boolean): string {
  let out = '';
  for (const byte of Buffer.from(input, 'utf8')) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.~]/.test(ch)) {
      out += ch;
    } else if (ch === '/' && !encodeSlash) {
      out += '/';
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

/** Canonical URI: encode each path segment but keep '/' separators. */
function canonicalPath(path: string): string {
  if (!path || path === '/') return '/';
  return path
    .split('/')
    .map((segment) => uriEncode(segment, true))
    .join('/');
}

interface SignRequestParams {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  body?: Buffer;
  endpointBase: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function signRequest(params: SignRequestParams): SignedRequest {
  const endpoint = new URL(params.endpointBase);
  const host = endpoint.host;
  const origin = endpoint.origin;

  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(params.body ?? EMPTY_BUFFER);

  // Canonical headers: host + x-amz-* + user headers, sorted, lowercase.
  const allHeaders: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [name, value] of Object.entries(params.headers)) {
    allHeaders[name.toLowerCase()] = value.trim().replace(/\s+/g, ' ');
  }
  const sortedNames = Object.keys(allHeaders).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${allHeaders[name]}\n`)
    .join('');
  const signedHeaders = sortedNames.join(';');

  const queryNames = Object.keys(params.query ?? {}).sort();
  const canonicalQuery = queryNames
    .map(
      (name) =>
        `${uriEncode(name, true)}=${uriEncode((params.query as Record<string, string>)[name], true)}`
    )
    .join('&');

  const canonicalRequest = [
    params.method.toUpperCase(),
    canonicalPath(params.path),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${S3_REGION}/${S3_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, S3_REGION);
  const kService = hmac(kRegion, S3_SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const encodedPath = canonicalPath(params.path);
  const url = `${origin}${encodedPath}${canonicalQuery ? `?${canonicalQuery}` : ''}`;

  // Note: `host` is intentionally part of the signed canonical headers but NOT
  // sent explicitly — fetch sets it from the URL, which matches exactly.
  return {
    url,
    headers: {
      authorization,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...params.headers,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Low-level request                                                  */
/* ------------------------------------------------------------------ */

interface R2RequestParams {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Buffer;
}

async function r2Fetch(config: R2Config, params: R2RequestParams): Promise<Response> {
  const base = (
    config.endpointUrl || `https://${config.accountId}.r2.cloudflarestorage.com`
  ).replace(/\/+$/, '');

  const { url, headers } = signRequest({
    method: params.method,
    path: params.path,
    query: params.query,
    headers: params.headers ?? {},
    body: params.body,
    endpointBase: base,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  return fetch(url, {
    method: params.method,
    headers,
    ...(params.body ? { body: params.body as unknown as BodyInit } : {}),
  });
}

async function r2ErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  const match = text.match(/<Message>([\s\S]*?)<\/Message>/);
  const message = match ? decodeXml(match[1]) : text.slice(0, 300);
  return `R2 request failed (${res.status}): ${message || res.statusText}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseListObjects(xml: string): R2Object[] {
  const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
  return contents.map((chunk) => {
    const key = decodeXml(chunk.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '');
    const size = parseInt(chunk.match(/<Size>(\d+)<\/Size>/)?.[1] ?? '0', 10);
    const lastModified = decodeXml(
      chunk.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? ''
    );
    return {
      key,
      size: Number.isFinite(size) ? size : 0,
      lastModified,
    };
  });
}

function parseListBuckets(xml: string): string[] {
  const buckets = xml.match(/<Bucket>[\s\S]*?<\/Bucket>/g) ?? [];
  return buckets
    .map((chunk) => decodeXml(chunk.match(/<Name>([\s\S]*?)<\/Name>/)?.[1] ?? ''))
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Public operations                                                  */
/* ------------------------------------------------------------------ */

export async function putObject(
  config: R2Config,
  params: { key: string; body: Buffer; contentType: string }
): Promise<void> {
  const res = await r2Fetch(config, {
    method: 'PUT',
    path: `/${config.bucketName}/${params.key}`,
    headers: { 'content-type': params.contentType },
    body: params.body,
  });
  if (!res.ok) throw new Error(await r2ErrorMessage(res));
}

/** Streams an object back. Caller is responsible for consuming/returning the body. */
export async function getObject(config: R2Config, key: string): Promise<Response> {
  return r2Fetch(config, {
    method: 'GET',
    path: `/${config.bucketName}/${key}`,
  });
}

export async function listObjects(
  config: R2Config,
  params: { prefix?: string; maxKeys?: number } = {}
): Promise<R2Object[]> {
  const query: Record<string, string> = { 'list-type': '2' };
  if (params.prefix) query.prefix = params.prefix;
  if (params.maxKeys) query['max-keys'] = String(params.maxKeys);

  const res = await r2Fetch(config, {
    method: 'GET',
    path: `/${config.bucketName}`,
    query,
  });
  if (!res.ok) throw new Error(await r2ErrorMessage(res));
  return parseListObjects(await res.text());
}

export async function deleteObject(config: R2Config, key: string): Promise<void> {
  const res = await r2Fetch(config, {
    method: 'DELETE',
    path: `/${config.bucketName}/${key}`,
  });
  if (!res.ok) throw new Error(await r2ErrorMessage(res));
}

/** Lists buckets on the account — used by the "Test Connection" flow. */
export async function listBuckets(config: R2Config): Promise<string[]> {
  const res = await r2Fetch(config, {
    method: 'GET',
    path: '/',
  });
  if (!res.ok) throw new Error(await r2ErrorMessage(res));
  return parseListBuckets(await res.text());
}
