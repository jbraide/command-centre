# Requirements Document — Command Center

## Introduction

The **Command Center** is a unified Next.js dashboard that centralizes every aspect of the user's life — business operations (LuxeRide car dealership, freelance invoicing), content creation (Instagram, fashion content), personal security (password management), and financial tracking. Instead of juggling separate tools, the user gets one authenticated hub where all data, tools, and workflows live.

The app will be built iteratively. This document covers the full vision, with **Phase 1** being the core foundation and the first two modules (Password Manager + Reel Transcriber).

---

## Phase 1 — Core + First Modules

### R1 — Authentication & User System
**User Story:** As a user, I want to sign up and log in securely, so that my data is private and only accessible to me.

#### Acceptance Criteria
1. WHEN a user visits the app without being authenticated THEN the system SHALL redirect them to a login page.
2. WHEN a user provides valid email and password on the login page THEN the system SHALL authenticate them and redirect to the dashboard.
3. WHEN a user registers with email and password THEN the system SHALL create an account and log them in.
4. IF a user provides incorrect credentials THEN the system SHALL display an appropriate error message.
5. WHEN a user clicks "logout" THEN the system SHALL end their session and redirect to the login page.
6. IF a user is already authenticated AND visits the login page THEN the system SHALL redirect them to the dashboard.

### R2 — Dashboard Layout & Navigation
**User Story:** As a user, I want a clean dashboard with sidebar navigation, so that I can easily access all modules.

#### Acceptance Criteria
1. WHEN a user logs in THEN the system SHALL display a dashboard with a sidebar navigation.
2. WHEN a user clicks a module in the sidebar THEN the system SHALL navigate to that module's page.
3. WHEN the screen is narrow (mobile) THEN the system SHALL collapse the sidebar into a hamburger menu.
4. WHEN the dashboard loads THEN the system SHALL show a home/dashboard overview page with summary widgets.

### R3 — Password Manager Module
**User Story:** As a user, I want a secure password vault, so that I can store and retrieve my credentials in one place.

#### Acceptance Criteria
1. WHEN a user navigates to the password manager THEN the system SHALL prompt for a master password to decrypt the vault.
2. WHEN the correct master password is entered THEN the system SHALL display the list of stored credentials.
3. WHEN a user clicks "Add Credential" THEN the system SHALL show a form with fields: website, username, password, notes.
4. WHEN a user saves a credential THEN the system SHALL encrypt it with AES-256-GCM (client-side) before storing.
5. WHEN a user views a credential THEN the system SHALL show the decrypted details with a "copy password" button.
6. WHEN a user searches in the vault THEN the system SHALL filter credentials by website or username in real-time.
7. WHEN a user clicks "delete" on a credential THEN the system SHALL prompt for confirmation before removing it.
8. IF the master password is incorrect THEN the system SHALL display an error and not decrypt any data.

### R4 — Reel Transcriber Module
**User Story:** As a content creator, I want to paste an Instagram reel URL and get a transcript, so that I can repurpose spoken content into captions, notes, or research.

#### Acceptance Criteria
1. WHEN a user navigates to the transcriber THEN the system SHALL show an input field for an Instagram reel URL.
2. WHEN a user submits a valid Instagram reel URL THEN the system SHALL download the audio and transcribe it.
3. WHEN transcription completes THEN the system SHALL display the transcript with the reel title, duration, and detected language.
4. WHEN transcription is in progress THEN the system SHALL show a loading/progress state.
5. IF the URL is invalid or unreachable THEN the system SHALL display a clear error message.
6. WHEN the user clicks "Copy Transcript" THEN the system SHALL copy the full text to clipboard.

### R6 — Todo List
**User Story:** As a busy person, I want a simple todo list, so that I can track tasks across my business and personal life.

#### Acceptance Criteria
1. WHEN a user navigates to the todo list THEN the system SHALL display all tasks grouped by status (pending / completed).
2. WHEN a user clicks "Add Task" THEN the system SHALL show an inline form with fields: title, description (optional), due date (optional), and tags (user-created, e.g. LuxeRide, Content, Personal).
3. WHEN a user saves a task THEN the system SHALL add it to the pending list.
4. WHEN a user clicks the checkbox on a task THEN the system SHALL mark it as completed and move it to the completed section.
5. WHEN a user clicks a task title THEN the system SHALL expand it to show full details and description.
6. WHEN a user clicks "delete" on a task THEN the system SHALL prompt for confirmation before removing it.
7. WHEN a user uses the search/filter bar THEN the system SHALL filter tasks by title, tag, or status in real-time.
8. WHEN a user creates a new tag that doesn't exist yet THEN the system SHALL create it and associate it with the task.
9. WHEN a user clicks on a tag name THEN the system SHALL filter the task list to show only tasks with that tag.

### R5 — Invoice Manager (Requires External API — On Hold)
**User Story:** As a business owner, I want to create and view invoices, so that I can track who I've billed for LuxeRide and freelance work.

#### Status: ⏸️ ON HOLD — Requires external API integration

The Invoice Manager will connect to an external invoicing API (to be built later) to pull invoice data and manage it within the dashboard. Not yet implemented.

#### Acceptance Criteria (Future)
1. WHEN a user navigates to invoices THEN the system SHALL fetch and display invoices from the external API.
2. WHEN a user clicks "New Invoice" THEN the system SHALL send invoice data to the external API.
3. When the external API is unavailable THEN the system SHALL display a clear offline message.

---

## Phase 2 — Business Ops (Future)

### R6 — Transaction Ledger
**User Story:** As a business owner, I want to import CSV transaction data and see my income vs expenses visualized.

### R7 — Customer/Lead CRM
**User Story:** As a car dealer, I want to track customer leads and deal stages, so that I don't miss follow-ups.

### R8 — LuxeRide Inventory
**User Story:** As a car dealer, I want to manage my car inventory with photos, specs, and pricing.

---

## Phase 3 — Content & Productivity (Future)

### R9 — Content Calendar
**User Story:** As a content creator, I want to plan and schedule posts on a calendar.

### R10 — Notes & Journal
**User Story:** As a user, I want a quick-capture notes area for ideas, journaling, and random thoughts.

### R11 — Task Board
**User Story:** As a busy person, I want a simple Kanban-style task board to track what's on my plate.

### R12 — Link Locker
**User Story:** As a user, I want to save and organize important links and resources.

### R13 — Script Writer
**User Story:** As a content creator, I want to write, save, and manage video scripts with inspiration from my Instagram transcriptions.

#### Acceptance Criteria (Phase 1 — Standard)
1. WHEN a user navigates to Script Writer THEN the system SHALL show a list of saved scripts.
2. WHEN a user clicks "New Script" THEN the system SHALL open a script editor with title and content fields.
3. WHEN a user saves a script THEN the system SHALL store it and return to the script list.
4. WHEN a user clicks a script THEN the system SHALL open it for editing.
5. WHEN a user deletes a script THEN the system SHALL prompt for confirmation before removing it.
6. WHEN a user views a script THEN the system SHALL show a textarea for writing/editing the script content.
7. WHEN a user creates a Key Principle THEN the system SHALL store it with a title and content/description.
8. WHEN a user creates a Script Style THEN the system SHALL store it with name, description, and guidelines.

### R14 — AI Script Generation (DeepSeek V4)
**User Story:** As a content creator, I want to generate script drafts using AI, so that I can write faster with inspiration from my stored personas, principles, and styles.

#### Acceptance Criteria
1. WHEN a user provides a topic AND selects a persona/style THEN the system SHALL send a prompt to DeepSeek V4 and return a generated script draft.
2. WHEN DeepSeek API key is not configured THEN the system SHALL show a clear setup message.
3. WHEN AI generation is in progress THEN the system SHALL show a loading state.
4. IF the API returns an error THEN the system SHALL display the error to the user.

#### Technical
- Uses DeepSeek V4 API (OpenAI-compatible format) at `https://api.deepseek.com`
- Models: `deepseek-v4-flash` (fast) / `deepseek-v4-pro` (thinking/reasoning)
- API route: `POST /api/ai/generate`
- OpenAI SDK with lazy initialization (no build-time key requirement)

### R15 — Creator Personas (Planned)
**User Story:** As a content creator, I want to build voice profiles for creators I study, so that the AI can generate scripts inspired by their style.

#### Future
- Persona: name, description, color, active
- PersonaExample: links to saved transcriptions as style references
- PersonaLesson: written rules about hook style, pacing, structure, CTA patterns
- Script generation will use persona lessons + examples to match voice

### R16 — Idea Hub (Planned)
**User Story:** As a busy person, I want a central inbox to capture every idea before it's triaged into a Project, Script, or discarded.

#### Future
- Quick-add with title + optional tags
- Status: raw / promoted / archived
- Promote to Project or send to Script Writer with one click
- Filter by tag and status

#### Future — AI Layer
- The AI will use saved Instagram transcriptions as inspiration for script generation.
- The AI will pull from stored Key Principles and Script Styles to match the brand voice.
- Creator Personas will give the AI specific voice profiles to match.
- Idea Hub will provide the topic source for AI script generation.
- AI layer is built (DeepSeek V4 integrated) — UI integration with personas and ideas is pending.

---

## Technical Constraints

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Database**: SQLite (via Turso/libSQL) or PostgreSQL with Prisma ORM
- **Authentication**: Auth.js (NextAuth v5) with email/password
- **UI**: Tailwind CSS with shadcn/ui components
- **Password Encryption**: Web Crypto API (AES-256-GCM, client-side)
- **Transcriber Backend**: Python FastAPI microservice (existing template) or ported to Next.js API routes
- **AI**: DeepSeek V4 API (OpenAI-compatible) at `https://api.deepseek.com`, models `deepseek-v4-flash` / `deepseek-v4-pro`
- **Deployment**: Vercel (primary) with a small server for the transcriber worker
