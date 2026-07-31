# Deployment Caveats & Architecture Notes

> Known limitations, infrastructure notes, and migration considerations when moving the Command Center to cloud hosting (Vercel / AWS / Cloudflare).

---

## 🗄️ Database: SQLite → PostgreSQL (AWS RDS)

**Status:** ✅ Migrated (July 30, 2026)

- App now runs on **AWS RDS PostgreSQL** (`us-east-2`, public IP `3.147.3.100`)
- **165 rows migrated** across 24 tables via `scripts/migrate-sqlite-to-postgres.mjs`
- SQLite backup preserved: `prisma/dev.db` + `.env.sqlite-backup`

### ⚠️ Caveats
1. **`.env` uses the RDS public IP, not the hostname** — Node.js on this machine cannot resolve `command-center.c5ae0wcywc6j.us-east-2.rds.amazonaws.com` (DNS resolves via nslookup but Node fails). If the instance is recreated, the IP changes → update `DATABASE_URL`.
2. **`sslmode=no-verify`** is required because no CA bundle is configured in the connection string. For production, use `sslmode=require` + `sslcert` with the RDS CA bundle.
3. **RDS security group** currently allows `0.0.0.0/0` on port 5432 — **lock this down** to your IP (or a VPC) before going public.
4. **No migrations folder** — the schema was created with `prisma db push`. For production, generate a proper migration: `npx prisma migrate dev --name init`.

---

## ☁️ Vercel Deployment Considerations

**Status:** ⏳ Planned — target host for the dashboard.

### ✅ Vercel-Compatible
| Feature | Notes |
|---------|-------|
| API routes | Serverless functions (10s default timeout) |
| Auth.js (JWT) | Works with `AUTH_SECRET` env var |
| Prisma + PostgreSQL | Works with Neon / Vercel Postgres adapter |
| AI generation (DeepSeek) | Pure HTTP calls |
| Dashboard, Scripts, Personas, Projects, Habits, Focus Timer | All client-side + API |

### ❌ NOT Vercel-Compatible (Blocks)
| Feature | Why |
|---------|-----|
| **Video/Reel Transcriber** | Runs `exec()` → yt-dlp + ffmpeg + ONNX Whisper model. Serverless functions: no shell access, 10s timeout, 50MB size limit (Whisper ONNX is 42MB) |
| **AI Agent tool calling** | Currently broken anyway (see AI-SCRIPT-TESTING.md) |

### Options for the Transcriber
1. **Keep a small Node.js service on a VPS** — the transcriber runs there, Vercel proxies to it
2. **Use a transcription API** — Deepgram, AssemblyAI, or OpenAI Whisper API (replaces yt-dlp + local Whisper)
3. **Vercel Background Functions (Pro)** — 15min timeout, but still no shell commands → option 1 or 2 still needed

### Recommended Architecture
```
Vercel (Next.js dashboard + API)
  ├── PostgreSQL (Vercel Postgres / Neon)
  ├── DeepSeek API (AI generation)
  └── Transcriber → VPS service OR transcription API
```

---

## 🌐 Cloudflare

**Status:** ⏳ Considered, not selected.

- Cloudflare Pages static export **cannot run API routes** — the whole app needs a server
- Better used as a **CDN/proxy in front of the VPS** (caching, SSL, DDoS protection)

---

## 🔐 Security Notes

1. **`.env` is gitignored** — contains `NEXTAUTH_SECRET`, `API_KEY_ENCRYPTION_KEY`, `API_ACCESS_KEY`, `DATABASE_URL`. Set these in Vercel's dashboard, not in git.
2. **`tokens.txt` was deleted** — it contained real API keys + a GitHub token. It was never committed.
3. **`API_KEY_ENCRYPTION_KEY`** is required for the server-side API key encryption (used by DeepSeek integration). If lost, stored integration keys can't be decrypted.
4. **Password vault** uses client-side encryption — master password never reaches the server. Resetting it requires re-encrypting all entries.

---

## 🧪 Known Bugs / Issues

| Issue | Status |
|-------|--------|
| AI Agent doesn't call tools (DeepSeek V4 Flash + thinking mode) | 🔴 In progress — XML invoke parser needed |
| Instagram reel transcription → empty audio (needs cookies) | 🔴 Instagram blocks unauthenticated audio extraction |
| Whisper model (`@xenova/transformers`) returned empty text after cache clear | ✅ Fixed by reinstall + model re-download (still flaky — prefer API-based transcription) |
| Next.js SWC binary crash after interrupted npm install | ✅ Fixed — reinstall `@next/swc-linux-x64-gnu` |

---

## 🖥️ Local Development

```bash
# Start
systemctl --user start command-center

# Stop
systemctl --user stop command-center

# Restart (after env/schema changes)
systemctl --user restart command-center

# Logs
journalctl --user -u command-center -f

# Server: http://localhost:5522
```
