# Implementation Plan — Command Center (Phase 1)

## ✅ Setup + Auth + Transcriber

- [x] 1. Scaffold Next.js project with dependencies
  - Initialize Next.js 14+ with TypeScript, Tailwind, App Router
  - Install and configure shadcn/ui with custom dark theme
  - Install dependencies: prisma, next-auth, bcryptjs, lucide-react, sonner, zod
  - Set up project directory structure (src/app, components, lib, prisma)
  - _Requirements: R1, R2_

- [x] 2. Set up database with Prisma
  - Write Prisma schema (User model only for now)
  - Run prisma generate + prisma db push
  - Create lib/db.ts singleton
  - _Requirements: R1_

- [x] 3. Implement authentication with Auth.js
  - Configure Auth.js v5 with Credentials provider
  - Create auth config (lib/auth.ts) with authorize callback
  - Create API route handler for [...nextauth]
  - Implement registration API route (POST /api/auth/register)
  - Hash passwords with bcrypt
  - _Requirements: R1_

- [x] 4. Create auth pages (login + register)
  - Build (auth)/layout.tsx — centered card layout
  - Build login page with email/password form
  - Build register page with email/password form
  - Add form validation with zod
  - Add error display and toast notifications
  - _Requirements: R1_

- [x] 5. Create middleware for route protection
  - Write middleware.ts to check session on dashboard routes
  - Redirect unauthenticated users to /login
  - _Requirements: R1_

- [x] 6. Build dashboard layout with sidebar
  - Build (dashboard)/layout.tsx with sidebar + header
  - Build sidebar with navigation links (Home, Transcriber)
  - Implement responsive behavior (mobile hamburger menu)
  - Build dashboard home page with welcome message
  - _Requirements: R2_

- [x] 7. Integrate Instagram Transcriber
  - Keep Python microservice in instagram-transcriber/ directory
  - Create Next.js API route /api/transcribe that proxies to Python
  - Add error handling for when Python server is unavailable
  - _Requirements: R4_

- [x] 8. Build Transcriber UI page
  - Build URL input with submit button
  - Build loading/progress state
  - Build transcript result display (title, duration, language, text)
  - Add copy-to-clipboard functionality
  - _Requirements: R4_

- [x] 9. Fix ffmpeg/ffprobe for yt-dlp
  - Download static ffmpeg/ffprobe binaries
  - Update downloader.py to set ffmpeg_location
  - Add null logger to fix output error in background process
  - _Requirements: R4_

## 🔖 Saved Transcriptions

- [x] 10. Add SavedTranscription model to Prisma schema
  - Add model with fields: url, title, text, language, duration, userId
  - Run prisma generate + db push
  - _Requirements: New feature_

- [x] 11. Create API routes for saved transcriptions
  - POST /api/transcriptions — save a transcription
  - GET /api/transcriptions — list saved transcriptions
  - DELETE /api/transcriptions/[id] — delete a saved transcription
  - _Requirements: New feature_

- [x] 12. Update Transcriber UI with save button
  - Add "Save Transcription" button after successful transcription
  - Show saved/history list on the transcriber page
  - Add delete button for saved transcriptions
  - _Requirements: New feature_

## 📁 Projects + Tasks + Notes + Links

- [x] 13. Add Project, Task, Note, ProjectLink models to Prisma schema
  - Add all models with relations to User and each other
  - Use String for enums (SQLite compat)
  - Run prisma generate + db push
  - _Requirements: New feature_

- [x] 14. Create Project CRUD API routes
  - GET/POST /api/projects — list and create
  - GET/PUT/DELETE /api/projects/[id] — get, update, delete
  - Include task counts in list response
  - _Requirements: New feature_

- [x] 15. Create Tasks API routes
  - POST /api/projects/[id]/tasks — create task
  - PATCH/DELETE /api/projects/tasks/[id] — update and delete
  - Ownership chain verification
  - _Requirements: New feature_

- [x] 16. Create Notes + Links API routes
  - POST /api/projects/[id]/notes — create note
  - DELETE /api/projects/notes/[id] — delete note
  - GET/POST /api/projects/[id]/links — list and create links
  - DELETE /api/projects/links/[id] — delete link
  - _Requirements: New feature_

- [x] 17. Build Projects list page
  - Project cards with status, task progress, color indicator
  - New Project dialog with name, description, color picker
  - Loading and empty states
  - _Requirements: New feature_

- [x] 18. Build Project detail page with 3 tabs
  - Tasks tab: checkbox toggle, priority badge, add/delete
  - Notes tab: add/delete with textarea
  - Links tab: manual URL add + pick from saved transcriptions
  - Optimistic UI updates
  - _Requirements: New feature_

- [x] 19. Update sidebar with Projects link
  - Add Projects to navigation
  - Update dashboard home quick actions
  - _Requirements: New feature_

- [x] 20. Upgrade task creation with priority picker
  - Add LOW/MEDIUM/HIGH toggle buttons in add-task form
  - Send priority with POST request
  - _Requirements: New feature_

- [x] 21. Add inline task editing
  - Click task to expand inline edit form
  - Edit title, priority, due date, description
  - Save/Cancel with optimistic updates
  - Escape key to close
  - _Requirements: New feature_

- [x] 22. Premium task card UI
  - Colored left border by priority (green/amber/red)
  - Hover shadow effects, date chips, priority badges
  - _Requirements: New feature_

- [x] 23. Create Settings page
  - Profile section with user info
  - Transcriber default model size selector
  - Appearance and Danger Zone sections
  - Add to sidebar navigation
  - _Requirements: New feature_

## 📋 What's Left (Phase 1 Original)

- [x] 24. Password Manager (R3)
  - [x] 24. Password Manager (R3)  **Done**
  - Encrypted vault with AES-256-GCM, master password, add/view/copy/delete, password generator
  - _Requirements: R3_

- [ ] 25. Invoice Manager (R5)
  - Requires external API — on hold
  - _Requirements: R5_

##  Script Writer + AI Layer (Built)

- [x] 26. Script Writer CRUD (R13)
  - Create/edit/delete scripts with two-panel editor, Key Principles, Script Styles
  - _Requirements: R13_

- [x] 27. DeepSeek V4 AI Infrastructure
  - Lazy-initialized OpenAI SDK, POST /api/ai/generate, prompt builder
  - _Requirements: R14_

##  Brevo Email + API Key Store (Built)

- [x] 28. Brevo Email Integration
  - lib/email.ts with sendEmail() via Brevo REST API
  - POST /api/email/send — send transactional emails
  - API key configured in .env

- [x] 29. API Key Store
  - ApiKey model in Prisma with server-side AES-256-GCM encryption
  - lib/api-key-crypto.ts with encrypt/decrypt functions
  - CRUD API routes (list, create, get decrypted, delete)
  - UI page at /api-keys with add/view/copy/delete
  - Sidebar link under Security group

##  Integrations + Email (Built)

- [x] 30. Service Integrations module
  - ServiceIntegration model with JSON config storage
  - API routes: GET list, POST upsert, GET by id, PATCH, DELETE
  - Integrations list page at /integrations with service cards
  - Configure page at /integrations/[service] with API key picker
  - Integration config references API Key Store (interconnected)
  - Enable/disable toggle per service

- [x] 31. Brevo Email — fully configurable from UI
  - Send Test Email button on integration page
  - Email send route reads config from DB (falls back to .env)
  - Configurable sender name + sender email
  - Sidebar under Services group

- [x] 32. Cloudflare integration
  - Available as a service type in integrations
  - Config: Zone ID, Account Email, API key from store

- [ ] 35. Zapier MCP Configuration
  - Add "Zapier MCP" as a service type in the Integrations module (like Brevo, Cloudflare)
  - Configuration fields: API Key (stored in API Key Store), Zapier MCP endpoint URL, enabled services (checkboxes for Calendar, Gmail, Google Docs, etc.)
  - On configure/save: connect to the Zapier MCP server, discover available tools, and register them in the AI tool registry
  - Display connected services and available tools on the Zapier integration detail page
  - Add "Test Connection" button that pings the MCP server and returns the list of available tools
  - Store discovered tool schemas in the integration's JSON config for quick access
  - Other MCP-compatible servers can also be added with custom endpoint configs
  - _Requirements: R30_

- [x] 33. Data Export
  - GET /api/export — download all data as JSON
  - POST /api/export/send — email export to self via Brevo
  - Settings page section with Download + Email buttons
  - Excludes encrypted secrets

- [x] 34. Comprehensive docs
  - docs/FEATURES.md — full feature reference
  - Updated Kiro spec files
  - Removed Services section from Settings (now in Integrations)

##  Phase 2 & 3 (Future)

- [ ] Transaction Ledger — CSV import, income/expense charts
  - Prisma model: Transaction (date, description, amount, type, category)
  - CSV upload handler with column mapping UI
  - Income vs expense API aggregations
  - UI page with charts (line chart over time, category breakdown)
  - Dashboard widget with month-over-month comparison
  - _Requirements: R6_

- [ ] Customer/Lead CRM — LuxeRide customer tracking
  - Prisma model: CustomerLead (name, email, phone, source, stage, notes, dealValue)
  - Kanban view by deal stage (New / Contacted / Test Drive / Negotiating / Closed Won / Lost)
  - Add/edit customer with contact details
  - Follow-up task auto-creation on stage change
  - Search and filter by name, stage, source
  - _Requirements: R7_

- [ ] LuxeRide Inventory — Manage car inventory
  - Prisma model: CarInventory (make, model, year, vin, price, mileage, photos[], status)
  - Photo upload with gallery view
  - Specs and pricing management form
  - Inventory list with search/filter
  - Status tracking: Available / Pending / Sold
  - _Requirements: R8_

- [ ] Content Calendar — Plan and schedule posts
  - Prisma model: ContentPost (title, platform, scheduledDate, status, content, mediaUrls[])
  - Calendar month/week view with post indicators
  - Drag-and-drop to reschedule
  - Status pipeline: Draft / Scheduled / Published
  - Link to Script Writer for Instagram content
  - _Requirements: R9_

- [ ] Notes & Journal — Quick-capture notes
  - Prisma model: Note (title, content, tags[], pinned)
  - Rich text or markdown editor
  - Tag-based filtering and search
  - Pin/unpin important notes
  - _Requirements: R10_

- [ ] Task Board — Kanban task view
  - Extend existing task model with boardPosition and column
  - Columns: Backlog / To Do / In Progress / Done
  - Drag-and-drop between columns
  - _Requirements: R11_

- [ ] Link Locker — Save and organize links
  - Prisma model: SavedLink (url, title, description, tags[], favicon)
  - Auto-fetch title/description/og:image on save
  - Tag-based filtering, search, grid/list view
  - _Requirements: R12_

- [ ] Personal CRM — Contact follow-ups
  - Prisma model: PersonalContact (name, email, phone, notes, lastContacted, frequency)
  - Contact list with search
  - Follow-up reminders based on frequency setting
  - Contact history / interaction log
  - _Requirements: (New feature)_

##  Phase 4 — Life Management

- [x] 1. Idea Hub (Central Capture)
  - Prisma model: Idea (id, title, rawNotes, tags (JSON string array), status, linkedProjectId, linkedScriptId, userId, createdAt, updatedAt)
  - API routes:
    - GET /api/ideas — list with filters (?status, ?tag)
    - POST /api/ideas — create idea
    - PATCH /api/ideas/[id] — update status, edit content, link project/script
    - DELETE /api/ideas/[id] — delete idea
  - Frontend page at /ideas:
    - Quick-add bar at top (title + optional tags)
    - Single-column feed sorted by createdAt desc
    - Each idea card: title, rawNotes preview, tags chips, status badge, action buttons
    - Promote to Project dialog (create new or link existing project)
    - Send to Script Writer -> navigates to /scripts/new with pre-filled content
    - Archive button with optimistic UI
    - Filter sidebar/dropdown: by tag and status
  - _Requirements: R17_

- [x] 2. Creator Personas
  - Prisma models:
    - CreatorPersona (id, name, description, colorTag, active, userId, createdAt, updatedAt)
    - PersonaExample (id, personaId FK, sourceType, transcriptionId optional FK, content, note, createdAt)
    - PersonaLesson (id, personaId FK, title, content, createdAt)
  - API routes:
    - CRUD /api/personas — list, create, get, update, delete
    - CR /api/personas/[id]/examples — list, create examples
    - DELETE /api/personas/examples/[id]
    - CR /api/personas/[id]/lessons — list, create lessons
    - DELETE /api/personas/lessons/[id]
    - GET /api/personas/[id]/scripts — list generated scripts using this persona
  - Frontend:
    - /personas — grid of persona cards (colored left border, active badge)
    - New Persona dialog: name, description, color picker, active toggle
    - /personas/[id] — detail page with 3 tabs:
      - Examples: list with source type badge, link to transcription, add from saved transcriptions
      - Lessons: add/edit/delete with title and content
      - Generated Scripts: list of scripts linked to this persona
  - Tie-in with Reel Transcriber:
    - On saved transcription detail, add "Tag as Persona Example" button
    - Opens persona picker, creates PersonaExample with sourceType="transcription" and transcriptionId
  - _Requirements: R18_

- [x] 3. Wire Personas + Ideas into AI Generator
  - Extend Script Prisma model: add personaId (optional FK), ideaId (optional FK)
  - Update Prisma schema and run generate + db push
  - Update prompt builder in lib/ai.ts or similar:
    - If personaId provided, fetch persona's lessons + examples and include in system prompt
    - If ideaId provided, include idea's title + rawNotes as topic context
    - If styleId provided, include style guidelines (already done)
  - Update /scripts/new UI:
    - Topic source picker: tabs/radio for "Paste Text" / "From Idea Hub" / "Link Project"
    - "From Idea Hub": show modal/dropdown to select from raw ideas
    - "Link Project": show project picker
    - Persona selector: dropdown of active personas with color indicator
    - Style selector: existing styles dropdown
    - Constraints input: optional free-form text field
    - Hidden fields: personaId, ideaId sent with form submission
  - Post-generation: link created script back to persona's generated scripts tab
  - _Requirements: R19_

- [ ] 4. Voice Memo Transcription
  - Upload handler:
    - API route: POST /api/voice-notes/upload — accepts multipart audio file
    - Store uploaded file temporarily in /tmp or serverless-friendly blob store
    - Reuse existing @xenova/transformers pipeline for transcription
    - Return transcript text
  - API routes:
    - POST /api/voice-notes/transcribe — transcribe an uploaded file
    - POST /api/voice-notes/save-journal — save transcript as Journal entry
    - POST /api/voice-notes/send-idea — send transcript to Idea Hub
  - Frontend page at /voice-notes:
    - Drag-and-drop upload area or file picker (accepts .mp3, .m4a, .wav, .webm)
    - Recording button (if MediaRecorder API is available)
    - Progress / loading state during transcription
    - Transcript result display with copy button
    - Action buttons: "Save as Journal Entry", "Send to Idea Hub"
  - _Requirements: R20_

- [ ] 5. Subscriptions Tracker
  - Prisma model: Subscription (id, name, amount (Decimal), currency, billingCycle, nextDueDate, category, active, userId, createdAt, updatedAt)
  - API routes:
    - CRUD /api/subscriptions — list (sorted by nextDueDate asc), create, update, delete
    - PATCH /api/subscriptions/[id] — toggle active, update any field
  - Frontend page at /subscriptions:
    - List view sorted by nextDueDate asc
    - Each row: name, amount with currency, billing cycle badge, next due date, category tag, active toggle
    - Red/orange badge on items due within 7 days
    - Add/Edit subscription form with all fields
    - Filter: show active only / show all
  - Dashboard widget:
    - Show next 3-5 upcoming bills with due date countdown
    - Total monthly/yearly spend summary
  - Optional:
    - Setting: "Auto-create Tasks for upcoming renewals"
    - Cron or on-access check: create Task for subscriptions due within 3 days
  - _Requirements: R21_

- [ ] 6. Personal Finance Snapshot
  - Prisma models:
    - FinanceAccount (id, name, type, currentBalance (Decimal), currency, userId, createdAt, updatedAt)
    - FinanceEntry (id, accountId FK, amount (Decimal), direction, category, note, date, createdAt)
  - API routes:
    - CRUD /api/finance/accounts — list, create, update, delete
    - CRUD /api/finance/accounts/[id]/entries — list, create, update, delete
    - Account balance auto-updates on entry creation
  - Frontend:
    - /finance — list of accounts with type icon, current balance
    - Click account -> entries list sorted by date desc
    - Add Entry form: amount, direction (in/out), category, note, date
    - Add Account form: name, type dropdown, initial balance, currency
  - Dashboard widget:
    - Net position card (total assets - total liabilities)
    - Donut/ring chart: spending breakdown by category (last 30 days)
    - Use recharts or chart.js for the chart
  - _Requirements: R22_

- [ ] 7. Goals & Quarterly Reviews
  - Prisma models:
    - Goal (id, title, description, targetDate, status, linkedProjectIds (JSON string array), userId, createdAt, updatedAt)
    - ReviewEntry (id, period, wins, misses, nextFocus, userId, createdAt)
  - API routes:
    - CRUD /api/goals — list, create, update, delete
    - PATCH /api/goals/[id]/status — drag-to-update status
    - CRUD /api/reviews — list, create, update, delete
    - GET /api/reviews/stats?period=... — aggregated Project/Task stats for that period
  - Frontend:
    - /goals — Kanban board with 3 columns: Active, Hit, Missed
    - Drag-and-drop between columns (uses @hello-pangea/dnd or similar)
    - New Goal dialog: title, description, target date picker, linked projects (multi-select)
    - Goal cards show linked project count, target date, days remaining
    - Past-due active goals get warning indicator
    - /reviews — Quarterly review form:
      - Period selector (e.g. "2026-Q3")
      - Auto-populated stats: completed tasks count, projects completed, goals hit/missed
      - Wins / Misses / Next Focus text areas
      - Save for historical reference
      - List of past reviews with expand to read
  - _Requirements: R23_

- [ ] 8. Daily Journal
  - Prisma model: JournalEntry (id, date (Date), content, tags (JSON string array), userId, createdAt, updatedAt)
  - API routes:
    - GET /api/journal?month=&year= — list entries for a month
    - GET /api/journal/[date] — get entry for specific date
    - POST /api/journal — create or update entry for a date
    - DELETE /api/journal/[id] — delete entry
  - Frontend page at /journal:
    - Calendar month view (build custom or use react-day-picker/shadcn calendar)
    - Dots on days that have entries
    - Click day: right panel or modal opens with editor
    - Editor: textarea or rich text area for content, tag input
    - Save button creates/updates entry
    - Month navigation (prev/next arrows, month/year label)
    - On mount, load current month entries; on month change, fetch new month
  - _Requirements: R24_

- [ ] 9. Reading & Learning Tracker
  - Prisma model: LearningItem (id, title, type, url optional, status, notes, userId, createdAt, updatedAt)
  - API routes:
    - CRUD /api/learning — list, create, update, delete
    - PATCH /api/learning/[id]/status — drag-to-update status
  - Frontend:
    - /learning — Kanban board: To Read, In Progress, Done
    - Drag-and-drop between columns
    - Add Item dialog: title, type dropdown (Article/Book/Course), URL optional, notes
    - Click item: expand inline or modal to view/edit full notes and URL
    - Type icon/color on cards
  - _Requirements: R25_

- [ ] 10. Subtasks (Task Hierarchy)
  - Prisma schema update:
    - Add parentId (optional, self-relation FK) to Task model
    - Run prisma generate + db push
  - API updates:
    - PATCH /api/projects/tasks/[id] — accept parentId in update, reject if parentId already has a parent (one level deep enforcement)
    - POST /api/projects/[id]/tasks — accept parentId on creation
    - GET /api/projects/[id]/tasks — include subtasks in response with parentId grouping
  - Frontend updates:
    - When task is expanded, show subtasks section below task details
    - "Add Subtask" inline input (title only, or title + optional details)
    - Subtask rows: checkbox to complete, title, delete button
    - No expand on subtasks (one level only)
    - Progress indicator on parent task (e.g. "2/4 subtasks complete" with progress bar)
    - Create/edit task forms updated to accept parentId
  - _Requirements: R26_

## Phase 5 — AI Agent

- [x] 1. MCP Client Integration *(Tool Registry only — MCP client skipped)*
  - Created `lib/ai/tool-registry.ts` — central registry for tool definitions with Zod validation
  - Created `lib/ai/mcp-client.ts` — MCP client stub (not connected to any MCP servers)
  - Implemented OpenAI-compatible tool-calling format for DeepSeek V4
  - _Requirements: R27_

- [x] 2. Internal Tool Registry
  - Created `lib/ai/internal-tools.ts` with 24+ internal tools (search_projects, get_project, get_tasks, create/update/delete_task, get_notes, create/delete_note, get_links, create/delete_link, get_ideas, promote/archive_idea, get_scripts, generate_script, get_personas/persona, get_principles, get_styles, get_transcriptions, get_dashboard, create/update/delete_project, create_persona_lesson/example, get_api_keys, get_integrations)
  - All tools have Zod schema validation
  - All handlers scope queries to authenticated user
  - Registered with tool registry on startup
  - _Requirements: R28_

- ~~3. External MCP Tool Definitions — Skipped (depends on MCP client being fully connected)~~

- [x] 4. Chat UI Component
  - Prisma models: `ChatSession` and `ChatMessage`
  - API routes: sessions CRUD (GET list, POST create, GET messages, DELETE)
  - `/ai` page with sidebar (session list) + chat panel
  - Components: chat-sidebar, chat-messages, chat-input, message-bubble (with Step Tracker), tool-card
  - Tool-call indicators: spinner (pending/running), checkmark (success), error, retry countdown
  - Streaming text via SSE with animated cursor
  - Added `/ai` link to sidebar under "AI" group
  - _Requirements: R29_

- [x] 5. AI Agent Chat API Route
  - Created `POST /api/ai/chat` with plan-based tool execution
  - DeepSeek V4 tool-calling integration with multi-round support (max 10 rounds, max 12 calls/turn)
  - SSE streaming with events: plan, step_start, step_complete, step_retry, step_error, text, done, error
  - Fallback to plain chat completion when no tool matches
  - Saves all messages to ChatMessage table
  - Session ownership verification
  - _Requirements: R27, R29_

- [x] 6. Tool Routing Engine
  - Created `lib/ai/tool-router.ts` — dispatches tool calls to correct handler
  - Validates all args against Zod schema before execution
  - Timeout handling: 10s for internal tools, 30s for external
  - Logs all tool calls with timestamp, params, success/failure, latency
  - _Requirements: R27, R28_

- ~~7. Zapier MCP Configuration — Done separately~~

- [x] 8. Agent Execution Engine
  - Created `lib/ai/agent.ts` with plan-based execution:
    - `ExecutionPlan` / `PlanStep` types with status tracking
    - `executePlan()` — sequential step execution
    - `executeStep()` — run with up to 3 retries (500ms, 1s, 2s backoff)
    - `autoFixArgs()` — parameter normalization (stringified JSON, boolean coercion)
    - `extractSummary()` — per-tool result summarization
    - `PlanCallbacks` — real-time SSE streaming via callbacks (onPlan, onStepStart, onStepComplete, onStepRetry, onStepError, onComplete)
  - _Requirements: R27, R28, R29_

## Phase 6 — Productivity & Focus

- [ ] 9. Eisenhower Matrix
  - Prisma: no new model — reuses existing Task model
  - Create `/matrix` page at `src/app/(dashboard)/matrix/page.tsx`:
    - 2×2 grid layout with colored quadrants (Do/Schedule/Delegate/Eliminate)
    - Fetch tasks from all user projects
    - Compute quadrant based on priority + dueDate proximity
    - Drag between quadrants → PATCH priority/dueDate
    - Inline task edit (reuses existing edit pattern)
    - Task counts per quadrant header
  - Add sidebar link: "Eisenhower Matrix" with icon (Grid3x3 or LayoutGrid)
  - _Requirements: R27_

- [ ] 10. Focus Timer (Pomodoro)
  - Prisma model: FocusSession (id, userId, taskId?, duration, breakDuration, completedPomodoros, startedAt, endedAt?, createdAt)
  - API routes:
    - POST /api/focus/sessions — create/start session
    - PATCH /api/focus/sessions/[id] — stop/pause session
    - GET /api/focus/sessions/today — get today's stats
  - Frontend: /focus page with:
    - Large circular timer (SVG circle progress)
    - Task selector dropdown
    - Start/Pause/Resume/Stop buttons
    - Session counter
    - Auto break mode
    - Desktop notifications (browser Notification API)
    - Sound on complete (Web Audio API beep)
  - Dashboard widget: today's focus time
  - Settings: focus duration presets, break duration, long break interval, sound toggle
  - Add sidebar link: "Focus Timer" with Timer icon
  - _Requirements: R28_

- [ ] 11. Recurring Tasks
  - Prisma: add repeatInterval, repeatEndDate, repeatCount to Task model
  - When a recurring task is completed, auto-create the next occurrence with updated due date
  - Add "Repeat" section to task create/edit form: interval dropdown, end condition
  - Skip action on recurring task archives without creating next
  - _Requirements: R29_

- [ ] 12. Reminders & Notifications
  - Prisma model: Reminder (id, userId, taskId?, ideaId?, triggerAt, title, note?, fired, createdAt)
  - API routes: CRUD for reminders
  - Auto-create reminder 1h before task due date
  - In-app notification center — bell icon in header with unread count
  - Dashboard widget: "Upcoming reminders"
  - Browser Notification API integration
  - _Requirements: R30_

- [ ] 13. Smart Lists / Saved Filters
  - Prisma model: SmartList (id, userId, name, icon?, filters JSON, createdAt)
  - API routes: CRUD for smart lists
  - /smart-lists page with saved filter views
  - "Save current filter" button in task views
  - Click smart list → apply filters
  - _Requirements: R31_

- [ ] 14. Habits & Streaks
  - Prisma models: Habit (id, userId, name, description?, frequency, color, active), HabitLog (id, habitId, date, completed, note?)
  - API routes: CRUD for habits, log entries
  - /habits page: list with today's checkbox, streak count, completion rate
  - Weekly calendar view per habit
  - Dashboard widget: today's habit completion
  - _Requirements: R32_

- [ ] 15. Focus Sounds / White Noise
  - Built into /focus page as a sound panel
  - Generate ambient sounds programmatically via Web Audio API (no files)
  - Presets: Rain, Forest, Ocean, White Noise, Coffee Shop
  - Play/stop with volume slider
  - _Requirements: R33_

- [ ] 16. Stopwatch
  - /stopwatch page with Start, Stop, Lap, Reset controls
  - Lap times list
  - Optional: export lap times as text
  - Add sidebar link
  - _Requirements: R34_

