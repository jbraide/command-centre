# Command Center

A unified dashboard for business operations, content creation, password management, and productivity.

Built with Next.js 16, TypeScript, Prisma + SQLite, and Tailwind CSS.

---

## Quick Start (Ubuntu / Elementary OS)

### 1. Install Dependencies

```bash
# Node.js 18+ and npm
sudo apt update && sudo apt install nodejs npm -y

# ffmpeg (for audio extraction in Reel Transcriber)
sudo apt install ffmpeg -y

# yt-dlp (for downloading Instagram reels)
sudo apt install yt-dlp -y
```

### 2. Clone & Install

```bash
git clone https://github.com/jbraide/command-centre.git
cd command-centre
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API keys:
# - DEEPSEEK_API_KEY (optional, for AI script generation)
# - BREVO_API_KEY (optional, for email sending)
```

### 4. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run

```bash
npm run dev
```

Open **http://localhost:3000** — register a new account and you're in.

> **Note:** The first time you transcribe a reel, the Whisper model (~150MB for tiny) downloads automatically. No Python setup needed.

---

## Default Test Account

- Email: `test@command.center`
- Password: `test123456`

---

## Modules

| Route | Module | Status |
|-------|--------|--------|
| `/` | Dashboard Home | ✅ |
| `/transcriber` | Reel Transcriber | ✅ |
| `/passwords` | Password Vault | ✅ |
| `/scripts` | Script Writer | ✅ |
| `/principles` | Key Principles | ✅ |
| `/styles` | Script Styles | ✅ |
| `/projects` | Projects Hub | ✅ |
| `/integrations` | Service Integrations | ✅ |
| `/api-keys` | API Key Store | ✅ |
| `/settings` | Settings | ✅ |
| `/invoices` | Invoices | ⏸️ Coming Soon |
| `/todos` | Tasks | 🔄 Moved to Projects |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | SQLite via Prisma ORM |
| Auth | Auth.js v5 (credentials) |
| UI | Tailwind CSS + lucide-react + sonner |
| Transcriber | yt-dlp + ffmpeg + Xenova/Transformers Whisper |
| AI | DeepSeek V4 (OpenAI-compatible) |
| Email | Brevo REST API v3 |
| Encryption | Web Crypto API (client-side AES-256-GCM + PBKDF2) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite path (default: `file:./dev.db`) |
| `NEXTAUTH_SECRET` | Yes | Auth.js session secret |
| `NEXTAUTH_URL` | Yes | App URL (default: `http://localhost:3000`) |
| `DEEPSEEK_API_KEY` | No | DeepSeek V4 API key for AI script generation |
| `DEEPSEEK_MODEL` | No | Model name (default: `deepseek-v4-flash`) |
| `BREVO_API_KEY` | No | Brevo API key for email sending |
| `API_KEY_ENCRYPTION_KEY` | No | Server-side encryption key for API Key Store |

---

## License

Private — use at your own discretion.
