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

- [ ] 24. Password Manager (R3)
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

- [ ] Creator Personas — Voice profiles with examples from transcriptions
- [ ] Idea Hub — Central capture inbox for ideas
- [ ] AI Script Generation — Wire personas + ideas into generator
- [ ] Transaction Ledger — CSV import, income/expense charts
- [ ] Customer/Lead CRM — LuxeRide customer tracking
- [ ] Content Calendar — Plan and schedule posts
- [ ] Voice Memo Transcription — Upload audio, reuse transcriber
- [ ] Subscriptions Tracker — Recurring bills with alerts
- [ ] Personal Finance Snapshot — Account balances, charts
- [ ] Goals & Quarterly Reviews — Track objectives
- [ ] Daily Journal — Calendar-based writing
- [ ] Reading Tracker — Articles, books, courses
- [ ] Personal CRM — Contact follow-ups
