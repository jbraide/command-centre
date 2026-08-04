# Command Center — Complete Feature Reference

> A unified Next.js dashboard that centralizes business operations, content creation, password management, productivity, and service integrations.

---

## 🔐 Authentication
**Route:** `/login`, `/register`
- Email/password registration and login via Auth.js v5
- JWT session management
- Protected routes (proxy/middleware redirects to login)
- Logout in sidebar footer
- Session user info displayed in sidebar

**Default test account:** `test@command.center` / `test123456`

---

## 🏠 Dashboard Home
**Route:** `/`

**Widgets:**
- Welcome header with user name + current date
- Stat pills: active projects count, total tasks, transcriptions saved
- Quick action cards: Transcribe Reel, Password Vault, Projects, Settings
- Active Projects widget: first 3 projects with color dot, task progress bar (X/Y), click → project detail
- Recent Transcriptions widget: first 3 with language badge, date, truncated text, click → transcriber
- Loading skeletons while fetching
- Graceful degradation if one API fails

---

## 🎬 Reel Transcriber
**Route:** `/transcriber`

**Features:**
- Paste Instagram reel URL → download + transcribe locally
- Backend: Python/FastAPI + yt-dlp + faster-whisper
- Model size selector: tiny / base / small / medium
- Result: title, duration, language, full text, segments with timestamps
- Copy transcript to clipboard
- Save transcription with segments (stored as JSON)
- Saved history panel (collapsible) — view, expand segments, delete
- Dark terminal/receipt-style UI

---

## 🔑 Password Manager
**Route:** `/passwords`

**Security:** Client-side AES-256-GCM via Web Crypto API
- Master password setup + unlock (PBKDF2, 600K iterations, SHA-256)
- Encryption key derived in-browser, stored in memory only
- Verify token stored in localStorage for re-entry

**Features:**
- Add credential: website, username, password, notes (encrypted before sending)
- View credential: fetch encrypted data → decrypt in-browser
- Copy password / copy username to clipboard
- Search/filter by website or username
- Delete with confirmation

**Password Generator:**
- Length slider: 6–64 characters (default 20)
- Toggle: A-Z, a-z, 0-9, symbols
- Exclude ambiguous characters (o, O, 0, l, 1, I)
- Uses `crypto.getRandomValues()`

---

## 📁 Projects Hub
**Route:** `/projects` (list), `/projects/[id]` (detail)

### Project List
- Cards with color indicator, description, task progress (X/Y), status badge
- New Project dialog: name, description, 6-color picker
- Loading and empty states

### Project Detail — 3 Tabs

#### Tasks Tab
- Add task with priority selector (Low/Medium/High toggle)
- Premium cards: colored left border by priority (green/amber/red)
- Checkbox toggle with optimistic UI
- Inline editing: click to expand → edit title, priority, due date, description
- Save/Cancel with Escape key
- Delete with confirmation

#### Notes Tab
- Add note with textarea
- List with date
- Delete with optimistic removal

#### Links Tab
- Add URL manually or **pick from saved transcriptions**
- Saved transcriptions list: selecting one auto-fills URL + title
- Links open in new tab; transcription preview if linked
- Delete with optimistic removal

---

## ✍️ Script Writer
**Route:** `/scripts`, `/principles`, `/styles`

### Scripts (`/scripts`)
- Two-panel layout: list (left) + editor (right)
- New Script → empty editor
- Editor: title input, large content textarea, style selector, project selector
- Manual save with Ctrl+S detection
- Save status indicator (Unsaved / Saving / Saved)
- Delete with confirmation

### Key Principles (`/principles`)
- Store brand voice guidelines, script rules, content principles
- Inline add/edit/delete
- **Future:** AI will reference these when generating scripts

### Script Styles (`/styles`)
- Define reusable script structures/templates
- Fields: name, description, guidelines
- Shows count of scripts using each style
- Inline add/edit/delete

---

## 🤖 AI Script Generation (DeepSeek V4)
**Route:** `POST /api/ai/generate`

- DeepSeek V4 API (OpenAI-compatible)
- Models: `deepseek-v4-flash` (fast) / `deepseek-v4-pro` (thinking)
- Prompt builder: persona lessons + examples + style + constraints
- Lazy-initialized OpenAI SDK (no build-time key requirement)
- Config: `DEEPSEEK_API_KEY` in `.env`

---

## 🔌 Service Integrations
**Route:** `/integrations`, `/integrations/[service]`

### Available Services
| Service | Status | What it does |
|---------|--------|-------------|
| **Brevo Email** | ✅ Built | Send transactional emails (invoices, notifications, etc.) |
| **Cloudflare R2** | ✅ Built | Object storage — upload/store/share files, images & videos (`/storage`); test connection on config page |

### Architecture
- Integrations reference API keys from the **API Key Store** (dropdown selector)
- Configure service-specific fields per integration
- Enable/disable toggle per service
- Save config encrypted in database

### Brevo Email — Test & Use
- "Send Test Email" button on config page to verify setup
- `POST /api/email/send` — send transactional emails
- Reads Brevo config from DB, falls back to `.env` key
- Default sender configurable in integration settings

---

## 🔑 API Key Store
**Route:** `/api-keys`

- Store API keys encrypted at rest (server-side AES-256-GCM)
- Fields: name, description, key (encrypted)
- Decrypt on demand for viewing/copying
- Integrations reference keys by ID (never paste raw keys)

---

## 📤 Data Export
**Route:** Settings → Export Data

- `GET /api/export` — Download all data as JSON file
- `POST /api/export/send` — Email export to yourself via Brevo
- Exports: projects, tasks, notes, links, transcriptions, scripts, principles, styles
- Excludes: encrypted passwords, encrypted API keys

**Exported data includes (without secrets):**
- Projects + nested tasks/notes/links
- Saved transcriptions (with segments)
- Scripts (with style reference)
- Key Principles + Script Styles
- Password entries (website + username only)
- API keys (name + description only)
- Service integrations (service + label + status only)

---

## ⚙️ Settings
**Route:** `/settings`

| Section | What's there |
|---------|-------------|
| **Profile** | View email and name from session |
| **Export Data** | Download JSON or email to self |
| **Transcriber** | Default model size picker (localStorage) |
| **Appearance** | Dark theme toggle (coming soon) |
| **Danger Zone** | Account deletion (coming soon) |

---

## 📄 Placeholder Pages
| Route | Status |
|-------|--------|
| `/invoices` | ⏸️ Coming soon — needs external API |
| `/todos` | 🔄 Task management moved to Projects |

---

## 📋 Full Route Map

```
/login              → Sign in
/register           → Create account
/                   → Dashboard home
/transcriber        → Reel Transcriber
/passwords          → Password Vault
/scripts            → Script Writer
/principles         → Key Principles
/styles             → Script Styles
/projects           → Projects list
/projects/[id]      → Project detail
/integrations       → Service Integrations
/integrations/[id]  → Configure a service
/api-keys           → API Key Store
/invoices           → Coming soon
/todos              → Coming soon
/settings           → Settings
```

---

## 🗄️ Database Models

```
User ──────────────────────────────────────────────┐
  ├── SavedTranscription (url, title, text, lang,  │
  │     duration, segments JSON)                   │
  │   └── ProjectLink (url, title, transcription)   │
  ├── PasswordEntry (website, username, encrypted)  │
  ├── Project (name, description, color, status)    │
  │   ├── Task (title, dueDate, priority, done)     │
  │   ├── Note (content)                            │
  │   └── ProjectLink (url, title, transcription)   │
  ├── Script (title, content, style?, project?)     │
  ├── KeyPrinciple (title, content)                 │
  ├── ScriptStyle (name, description, guidelines)   │
  ├── ApiKey (name, description, encrypted)         │
  └── ServiceIntegration (service, label, config    │
        JSON, enabled)                              │
```

---

## 💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + TypeScript |
| **Database** | SQLite via Prisma ORM |
| **Auth** | Auth.js v5 (NextAuth) — credentials |
| **UI** | Tailwind CSS + CSS variables + lucide-react |
| **Toasts** | sonner |
| **Encryption** | Web Crypto API (client-side, AES-256-GCM + PBKDF2) |
| **Server Crypto** | Node.js crypto (server-side, AES-256-GCM) |
| **Transcriber** | Python/FastAPI + yt-dlp + faster-whisper |
| **AI** | DeepSeek V4 (OpenAI-compatible SDK) |
| **Email** | Brevo REST API v3 |

---

## 📦 Claude's Future Ideas (from ai-ideas/)

| Idea | What it is |
|------|-----------|
| **Idea Hub** | Central capture inbox → promote to Project or Script |
| **Creator Personas** | Voice profiles with examples from transcriptions |
| **Personal Finance** | Account balances, category charts |
| **Voice Memo Transcription** | Upload audio, reuse transcriber pipeline |
| **Subscriptions Tracker** | Recurring bills with due date alerts |
| **Daily Journal** | Calendar-based private writing space |
| **Goals & Quarterly Reviews** | Track objectives, auto-pull task stats |
| **Reading Tracker** | Books, articles, courses with notes |
| **Personal CRM** | Contact follow-ups and relationship tracking |
| **Focus Timer** | Pomodoro widget tied to tasks |
| **Weekly Digest** | Monday summary emailed to you |
