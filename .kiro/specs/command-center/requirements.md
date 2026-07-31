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

## Phase 4 — Life Management

### R17 — Idea Hub (Central Capture)
**User Story:** As a busy person, I want a single inbox to capture every thought before it's triaged into a Project, Script, or discarded.

#### Data Model
- **Idea**: title, rawNotes, tags[] (string array), status (raw / promoted / archived), linkedProjectId (optional FK), linkedScriptId (optional FK)

#### UI
- `/ideas` — single-column feed, quick-add bar, Promote to Project / Send to Script Writer / Archive actions
- Filter by tag and status

#### Acceptance Criteria
1. WHEN a user visits `/ideas` THEN the system SHALL display all ideas in a single-column feed sorted by recency.
2. WHEN a user types into the quick-add bar and presses Enter THEN the system SHALL create a new Idea in "raw" status.
3. WHEN a user clicks "Promote to Project" on an idea THEN the system SHALL open a dialog to create a new Project (or link to an existing one) and mark the idea as "promoted".
4. WHEN a user clicks "Send to Script Writer" on an idea THEN the system SHALL navigate to `/scripts/new` with the idea's content pre-filled and link the idea.
5. WHEN a user clicks "Archive" on an idea THEN the system SHALL move it to "archived" status.
6. WHEN a user uses the filter controls THEN the system SHALL filter ideas by tag and/or status in real-time.
7. WHEN a user clicks on an idea's linked project or script THEN the system SHALL navigate to that entity's detail page.

### R18 — Creator Personas
**User Story:** As a content creator, I want to build voice profiles for creators I study, so that the AI can generate scripts inspired by their style.

#### Data Model
- **CreatorPersona**: name, description, colorTag, active (boolean)
- **PersonaExample**: personaId (FK), sourceType (transcription / manual), transcriptionId (optional FK), content, note
- **PersonaLesson**: personaId (FK), title, content

#### UI
- `/personas` — grid of persona cards with color indicators
- `/personas/[id]` — detail page with three tabs: Examples, Lessons, Generated Scripts
- Tie-in with Reel Transcriber: saved transcriptions can be tagged as persona examples

#### Acceptance Criteria
1. WHEN a user navigates to `/personas` THEN the system SHALL display all persona cards in a grid layout with name, description, and color tag.
2. WHEN a user clicks "New Persona" THEN the system SHALL show a form with name, description, color picker, and active toggle.
3. WHEN a user clicks a persona card THEN the system SHALL navigate to `/personas/[id]` with three tabs: Examples, Lessons, Generated Scripts.
4. WHEN a user is on the Examples tab THEN the system SHALL allow adding transcriptions from the Reel Transcriber or writing manual examples.
5. WHEN a user is on the Lessons tab THEN the system SHALL allow creating/deleting lessons with title and content.
6. WHEN a user is on the Generated Scripts tab THEN the system SHALL list scripts that were generated using this persona.
7. WHEN a user views a saved transcription THEN the system SHALL display a "Tag as Persona Example" button that links it to a selected persona.

### R19 — AI Script Generation with Personas + Ideas
**User Story:** As a content creator, I want to generate scripts that incorporate my persona profiles and captured ideas, so that the AI writes in a studied voice on a chosen topic.

#### Data Model Changes
- **Script** model gets: personaId (optional FK), ideaId (optional FK)

#### Generation Prompt
- AI prompt includes: selected persona's lessons + examples, the chosen idea as topic, selected script style constraints

#### UI
- `/scripts/new` extended with:
  - **Topic source picker**: paste text, pull from Idea Hub (select an idea), or link a Project (use project title/description as context)
  - **Persona selector**: dropdown of active CreatorPersonas
  - **Style selector**: existing Script Styles
  - **Constraints input**: optional free-form instructions

#### Acceptance Criteria
1. WHEN a user navigates to `/scripts/new` THEN the system SHALL show the extended form with topic source, persona, style, and constraints fields.
2. WHEN a user selects "Pull from Idea Hub" THEN the system SHALL open a picker showing available raw ideas.
3. WHEN a user selects a persona THEN the system SHALL include that persona's lessons and examples in the prompt sent to DeepSeek V4.
4. WHEN a user selects a style THEN the system SHALL append the style's guidelines to the prompt.
5. WHEN the AI generates a script with a linked persona and/or idea THEN the system SHALL store the FK references on the Script model.
6. WHEN a script has a linked persona THEN the generated script SHALL appear on the persona's Generated Scripts tab.

### R20 — Voice Memo Transcription
**User Story:** As a content creator, I want to upload audio files (voice memos, recordings) directly and get them transcribed, so that I can capture spoken notes or repurpose recorded content.

#### Technical
- Upload audio file (supports MP3, M4A, WAV, WebM)
- Reuses the existing `@xenova/transformers` pipeline from the Reel Transcriber
- No URL fetching needed — audio is already local

#### UI
- `/voice-notes` — record (if browser supports) or upload an audio file
- After transcription: display transcript, option to save as Journal entry or send to Idea Hub

#### Acceptance Criteria
1. WHEN a user navigates to `/voice-notes` THEN the system SHALL show an upload area for audio files (drag-and-drop or file picker).
2. WHEN a user selects an audio file THEN the system SHALL upload it and begin transcription.
3. WHEN transcription is in progress THEN the system SHALL show a progress indicator.
4. WHEN transcription completes THEN the system SHALL display the transcript text.
5. WHEN a user clicks "Save as Journal Entry" THEN the system SHALL create a Journal entry with the transcript as content.
6. WHEN a user clicks "Send to Idea Hub" THEN the system SHALL create an Idea with the transcript as rawNotes.
7. IF the browser supports the MediaRecorder API THEN the system SHALL also show a record button for live recording.

### R21 — Subscriptions & Recurring Bills Tracker
**User Story:** As a user, I want to track my recurring bills and subscriptions so that I never miss a renewal or waste money on unused services.

#### Data Model
- **Subscription**: name, amount, currency, billingCycle (monthly / yearly / quarterly / weekly), nextDueDate, category, active (boolean)

#### UI
- List sorted by next due date (closest first)
- Colored badge for items due within 7 days
- Dashboard widget showing upcoming bills
- Optional: auto-create Tasks for upcoming renewals (checkbox setting)

#### Acceptance Criteria
1. WHEN a user navigates to subscriptions THEN the system SHALL display all subscriptions sorted by next due date ascending.
2. WHEN a subscription is due within 7 days THEN the system SHALL show a red/orange badge.
3. WHEN a user clicks "Add Subscription" THEN the system SHALL show a form with name, amount, currency, billing cycle, next due date, category, and active toggle.
4. WHEN a user marks a subscription as inactive THEN the system SHALL hide it from the default list (show with filter).
5. WHEN the dashboard loads AND there are subscriptions due within 7 days THEN the system SHALL show a widget with those items.
6. IF the auto-create Tasks setting is enabled AND a subscription is due within 3 days THEN the system SHALL create/update a Task for renewal.

### R22 — Personal Finance Snapshot
**User Story:** As a user, I want to manually track account balances and transactions in one place so that I have a quick overview of my net worth and spending patterns.

#### Data Model
- **FinanceAccount**: name, type (checking / savings / credit / cash / investment), currentBalance, currency
- **FinanceEntry**: accountId (FK), amount, direction (in / out), category, note, date

#### UI
- Dashboard widget: net position (total assets - total liabilities), donut chart for category breakdown
- `/finance` — list of accounts with balances, click to see entries

#### Acceptance Criteria
1. WHEN a user navigates to `/finance` THEN the system SHALL show a list of accounts with current balance and type icon.
2. WHEN a user clicks "Add Account" THEN the system SHALL show a form with name, type, initial balance, and currency.
3. WHEN a user clicks on an account THEN the system SHALL show its transaction entries sorted by date.
4. WHEN a user adds a transaction entry THEN the system SHALL update the account's currentBalance.
5. WHEN the dashboard loads THEN the system SHALL show a net position widget and a donut chart of spending by category.

### R23 — Goals & Quarterly Reviews
**User Story:** As a user, I want to set objectives and review my progress each quarter so that I stay focused and accountable.

#### Data Model
- **Goal**: title, description, targetDate, status (active / hit / missed), linkedProjectIds[] (array of project FKs)
- **ReviewEntry**: period (e.g. "2026-Q3"), wins, misses, nextFocus

#### UI
- `/goals` — Kanban board: Active / Hit / Missed columns
- Quarterly review form that pulls Project and Task stats for the period

#### Acceptance Criteria
1. WHEN a user navigates to `/goals` THEN the system SHALL display a Kanban board with three columns: Active, Hit, Missed.
2. WHEN a user clicks "New Goal" THEN the system SHALL show a form with title, description, target date, and linked projects.
3. WHEN a user drags a goal to another column THEN the system SHALL update its status.
4. WHEN a goal's target date has passed AND it's still in Active THEN the system SHALL prompt the user to update status.
5. WHEN a user navigates to the quarterly review section THEN the system SHALL show a form pre-populated with completed tasks and project stats for the selected period.
6. WHEN a user saves a review entry THEN the system SHALL store it for future reference.

### R24 — Daily Journal
**User Story:** As a user, I want a private space to write daily entries with a calendar view so that I can reflect on my thoughts and revisit past entries easily.

#### Data Model
- **JournalEntry**: date, content, tags[] (string array)

#### UI
- `/journal` — calendar month view; click a day to write or read that day's entry
- Highlighted dots on days that have entries

#### Acceptance Criteria
1. WHEN a user navigates to `/journal` THEN the system SHALL show a calendar view for the current month.
2. WHEN a day has a journal entry THEN the system SHALL show a dot indicator on that day.
3. WHEN a user clicks a day THEN the system SHALL open an editor pane to write or read the entry.
4. WHEN a user saves an entry THEN the system SHALL persist it and show the dot on the calendar.
5. WHEN a user navigates to a different month THEN the system SHALL load entries for that month.
6. WHEN a user edits an existing entry THEN the system SHALL update it and keep the same date.

### R25 — Reading & Learning Tracker
**User Story:** As a lifelong learner, I want to track articles, books, and courses I'm consuming so that I can manage my learning pipeline.

#### Data Model
- **LearningItem**: title, type (article / book / course), url (optional), status (to-read / in-progress / done), notes

#### UI
- Kanban board by status: To Read / In Progress / Done

#### Acceptance Criteria
1. WHEN a user navigates to `/learning` THEN the system SHALL display a Kanban board with three columns: To Read, In Progress, Done.
2. WHEN a user clicks "Add Item" THEN the system SHALL show a form with title, type dropdown, URL (optional), and notes.
3. WHEN a user drags an item to another column THEN the system SHALL update its status.
4. WHEN a user clicks on an item THEN the system SHALL expand to show full notes and the URL link.

### R26 — Subtasks (Task Hierarchy)
**User Story:** As a task-oriented user, I want to break tasks into smaller subtasks so that I can track progress on complex work.

#### Data Model
- **Task** model gets: parentId (optional self-relation FK, one level deep)

#### UI
- Subtasks shown when a task is expanded
- Add / complete subtasks inline — no nested expansion

#### Acceptance Criteria
1. WHEN a user expands a task in the todo list or project tasks THEN the system SHALL show its subtasks below the task details.
2. WHEN a user clicks "Add Subtask" on an expanded task THEN the system SHALL show an inline input to create a subtask.
3. WHEN a user checks off a subtask THEN the system SHALL mark it as completed.
4. WHEN all subtasks of a parent task are completed THEN the system SHALL show a progress indicator on the parent task.
5. WHEN a subtask is created THEN the system SHALL set its parentId to the parent task's ID.
6. Subtasks SHALL NOT have their own subtasks (one level deep only).

---

## Phase 5 — AI Agent

### R27 — MCP / Tool-Calling Layer
**User Story:** As a user, I want to give natural language commands to an AI agent that can interact with both my Command Center data and configured external services, so that I can work faster without clicking through the UI.

#### Acceptance Criteria
1. WHEN the user opens the AI chat panel THEN the system SHALL provide a text input for natural language commands.
2. WHEN a user types a command like "create a task for oil change due next week" THEN the system SHALL interpret the intent and call the appropriate internal tool (`create_task`).
3. WHEN a user types "add an event to my calendar for Friday at 3pm" THEN the system SHALL route the request through the configured external MCP service (e.g. Zapier MCP) to create a Google Calendar event.
4. WHEN the AI calls a tool THEN the system SHALL show the user which tool is being invoked and its result.
5. IF a tool call fails THEN the system SHALL display a clear error message.
6. WHEN no tool matches the user's intent THEN the system SHALL fall back to a plain AI chat response.

#### Technical
- Integrate an MCP (Model Context Protocol) client into the AI layer
- The AI can call internal tools (CRUD on projects, tasks, scripts, transcriptions, ideas, etc.)
- The AI can call external MCP servers (e.g. Zapier MCP for calendar/email/Gmail — configured in the Integrations module)
- Tools have defined schemas (name, description, input parameters in JSON Schema format)
- The user can invoke the AI agent from a chat-like interface or command bar in the dashboard
- Approach: use DeepSeek V4's tool-calling/function-calling capability, route tool calls to either internal API handlers or external MCP servers

### R28 — AI Agent Capability Definitions
**User Story:** As a developer, I want a defined registry of every tool the AI agent can invoke, so that capabilities are documented, consistent, and easy to extend.

#### Internal Tools (System)

| Tool | Description | Input Schema |
|------|-------------|-------------|
| `search_projects` | Search projects by name/status | query: string, status?: string |
| `get_project_tasks` | Get tasks for a project | projectId: string, status?: string |
| `create_task` | Create a new task | projectId: string, title: string, priority?: string, dueDate?: string |
| `update_task` | Update task status | taskId: string, completed: boolean |
| `delete_task` | Delete a task | taskId: string |
| `get_transcriptions` | List saved transcriptions | limit?: number |
| `search_transcriptions` | Search transcriptions by text | query: string |
| `create_idea` | Add an idea to Idea Hub | title: string, rawNotes?: string, tags?: string[] |
| `get_ideas` | List ideas | status?: string, tag?: string |
| `generate_script` | Generate a script draft via AI | topic: string, personaId?: string, styleId?: string |
| `send_email` | Send an email via Brevo | to: string, subject: string, body: string |

#### External Tools (via MCP — Zapier / Custom Servers)

These tools become available when a compatible MCP service (e.g. Zapier MCP) is configured in the Integrations module. The tool schemas are discovered dynamically at connection time.

| Tool | Description | Service |
|------|-------------|---------|
| `add_calendar_event` | Add event to Google Calendar | Google Calendar (via MCP) |
| `get_calendar_events` | List upcoming calendar events | Google Calendar (via MCP) |
| `send_gmail` | Send email via Gmail | Gmail (via MCP) |
| `create_google_doc` | Create a Google Doc | Google Docs (via MCP) |

#### Acceptance Criteria
1. WHEN the system starts THEN the tool registry SHALL be initialized with all defined internal tools.
2. WHEN a new MCP server is connected THEN its tools SHALL be registered dynamically into the external tool list.
3. WHEN the AI receives a request THEN the system SHALL match the intent to the appropriate tool(s) based on their name and description.
4. EACH tool SHALL have a defined input schema (JSON Schema) specifying required and optional parameters.
5. Internal tools SHALL operate on the authenticated user's own data only.
6. External tools SHALL use stored API keys from the API Key Store for authentication.

### R29 — Chat / Command Interface
**User Story:** As a user, I want a persistent chat panel where I can type natural language commands and see results, so that I can interact with the Command Center conversationally.

#### UI
- `/ai` — full-page AI chat interface, accessible from the sidebar
- Chat panel with message bubbles (user + assistant)
- Text input with send button (Enter to send, Shift+Enter for newline)
- Tool call indicators — when the AI invokes a tool, show a small info card in the chat (e.g. "🔧 Creating task... ✅ Task created")
- Chat history persisted per session (in-memory or localStorage)

#### Acceptance Criteria
1. WHEN a user navigates to `/ai` THEN the system SHALL display a chat interface with message history.
2. WHEN a user sends a message THEN the system SHALL send it to the AI agent and display the response.
3. WHEN the AI invokes a tool THEN the system SHALL show a tool-call indicator in the chat flow.
4. WHEN the chat session ends THEN the system SHALL persist the conversation history.
5. WHEN the user refreshes the page THEN the system SHALL restore the previous chat session.

### R30 — Zapier MCP Service Integration
**User Story:** As a user, I want to configure Zapier (or any MCP-compatible service) from the Integrations module, so that the AI agent can access external services like my calendar, email, and docs.

#### Data / Config Model
- Config stored in the existing `ServiceIntegration` model with `type: "zapier-mcp"`
- Fields:
  - `apiKey` — API key (stored in the API Key Store, referenced by ID)
  - `endpointUrl` — MCP server endpoint URL
  - `enabledServices` — array of enabled service identifiers (e.g. `["calendar", "gmail", "docs"]`)
  - `discoveredTools` — cached tool schemas returned by the MCP server (JSON)

#### UI
- Configured at `/integrations/zapier` like other service integrations
- Fields: API key picker (from API Key Store), MCP endpoint URL
- Enable/disable checkboxes for discovered services (Calendar, Gmail, Google Docs, etc.)
- "Test Connection" button that pings the MCP server and returns the list of available tools with their schemas

#### Acceptance Criteria
1. WHEN a user navigates to `/integrations/zapier` THEN the system SHALL display configuration fields for the MCP endpoint URL and API key.
2. WHEN a user clicks "Test Connection" THEN the system SHALL connect to the MCP server, discover available tools, and display them.
3. IF the MCP server is unreachable THEN the system SHALL display a clear connection error.
4. WHEN a user saves the configuration THEN the system SHALL store the settings and cache discovered tool schemas in the integration config.
5. WHEN a user toggles a service off THEN the system SHALL prevent the AI agent from using tools for that service.
6. WHEN another MCP-compatible server is added with a custom endpoint THEN the system SHALL treat it the same way — connect, discover tools, and cache schemas.

---

## Phase 6 — Productivity & Focus

### R31 — Eisenhower Matrix
**User Story:** As a task-oriented user, I want to see my tasks organized in the Eisenhower Matrix (Urgent/Important quadrants) so that I can prioritize what matters most.

#### Data Model
- Reuses existing Task model with priority field
- Quadrants derived from:
  - **Urgency**: due within 48h = urgent
  - **Importance**: HIGH priority = important
- Custom quadrant assignment can override defaults

#### UI
- `/matrix` — 2×2 grid with quadrant labels, colors, and drag support
- Four quadrants:
  - **Q1 — Do** (urgent + important): red (#EF4444) — top-left
  - **Q2 — Schedule** (not urgent + important): blue (#3B82F6) — top-right
  - **Q3 — Delegate** (urgent + not important): amber (#F59E0B) — bottom-left
  - **Q4 — Eliminate** (not urgent + not important): gray (#6B7280) — bottom-right
- Tasks from all projects sorted into quadrants
- Click to expand/edit inline, drag between quadrants
- Empty-state message per quadrant when no tasks

#### Acceptance Criteria
1. WHEN a user navigates to `/matrix` THEN the system SHALL display a 2×2 grid with the four Eisenhower quadrants.
2. WHEN a task has HIGH priority AND is due within 48h THEN it SHALL appear in Q1 (Do).
3. WHEN a task has HIGH priority AND is due after 48h THEN it SHALL appear in Q2 (Schedule).
4. WHEN a task has LOW/MEDIUM priority AND is due within 48h THEN it SHALL appear in Q3 (Delegate).
5. WHEN a task has LOW/MEDIUM priority AND is due after 48h THEN it SHALL appear in Q4 (Eliminate).
6. WHEN a user drags a task to another quadrant THEN the system SHALL update priority/due date.
7. WHEN a user clicks a task in the matrix THEN it SHALL expand for inline editing.
8. WHEN a task has no due date THEN the system SHALL treat urgency as FALSE and place it in Q2 or Q4 based on priority.

### R32 — Focus Timer (Pomodoro)
**User Story:** As a knowledge worker, I want a built-in Pomodoro timer tied to my tasks so that I can focus and track time.

#### Data Model
```
FocusSession
 ├── id, userId, taskId?, duration (min), breakDuration (min)
 ├── completedPomodoros, startedAt, endedAt?, createdAt
 ├── status: "focus" | "break" | "completed" | "interrupted"
```

#### UI
- `/focus` — full-page timer with:
  - Large countdown timer (MM:SS) with circular SVG progress ring
  - Task selector dropdown (linked to existing tasks)
  - Start / Pause / Resume / Stop buttons
  - Session counter: "2/4 pomodoros"
  - Auto-break mode — switches between focus and break automatically
- Dashboard widget: today's total focus time (aggregated from sessions)
- Desktop notifications on timer completion (browser Notification API)
- Settings panel (gear icon):
  - Focus length presets: 15 / 25 / 45 / 60 minutes
  - Break length: 5 / 10 / 15 minutes
  - Long break after: 4 pomodoros
  - Sound toggle (enable/disable completion bell)

#### Acceptance Criteria
1. WHEN a user navigates to `/focus` THEN the system SHALL display a timer with Start button.
2. WHEN a user selects a task and starts the timer THEN the system SHALL create a FocusSession record and begin countdown.
3. WHEN the timer reaches zero THEN the system SHALL play a sound, fire a desktop notification, and auto-start the break timer.
4. WHEN break ends THEN the system SHALL increment completedPomodoros and reset to focus mode.
5. WHEN the user stops early THEN the system SHALL save elapsed time and mark the session as interrupted.
6. WHEN the dashboard loads THEN the system SHALL show today's total focus time aggregated from all sessions.
7. WHEN the browser Notification permission is granted THEN the system SHALL fire desktop notifications on focus and break completion.

### R33 — Recurring Tasks
**User Story:** As a busy person, I want tasks to repeat automatically so that I don't manually recreate routines.

#### Data Model
- Add to Task model:
  - `repeatInterval`: `"daily"` | `"weekly"` | `"monthly"` | `"yearly"` | `"weekdays"` | `null`
  - `repeatEndDate`: ISO date string (nullable) — stop after this date
  - `repeatCount`: number (nullable) — stop after N occurrences
  - `repeatOriginalId`: UUID (nullable) — references the source recurring task in the chain

#### UI
- Repeat section in task create/edit drawer:
  - Interval dropdown (None, Daily, Weekly, Monthy, Yearly, Weekdays)
  - End condition: "After N occurrences" (number input) or "On date" (date picker)
- On completion:
  - Mark current task complete
  - Auto-create the next occurrence with due date shifted by one interval
- Skip action in task menu archives the occurrence without creating a replacement

#### Acceptance Criteria
1. WHEN a task with weekly repeat is completed THEN the system SHALL create a new task due 7 days later.
2. WHEN repeatCount is set AND the count reaches zero THEN the system SHALL stop creating new occurrences.
3. WHEN repeatEndDate is set AND the next due date exceeds it THEN the system SHALL stop creating new occurrences.
4. WHEN a recurring task is skipped THEN the system SHALL archive it without creating a replacement.
5. WHEN a weekday-repeat task is completed on Friday THEN the next occurrence SHALL be due the following Monday.
6. WHEN the user updates a recurring task instance THEN the system SHALL apply changes only to that instance (not future ones).

### R34 — Reminders & Notifications
**User Story:** As a user, I want reminders for tasks and events so I never miss deadlines.

#### Data Model
```
Reminder
 ├── id, userId
 ├── taskId? (nullable, FK to Task)
 ├── ideaId? (nullable, FK to Idea)
 ├── triggerAt (ISO datetime)
 ├── title, note?
 ├── fired: boolean (default false)
 ├── createdAt
```

#### UI
- Bell icon in app header with unread count badge
- In-app notification center at `/notifications` — list of recent reminders and alerts
- Browser notifications via Notification API (permission prompt on first trigger)
- Dashboard widget: "Upcoming reminders" — next 3 reminders with time remaining

#### Acceptance Criteria
1. WHEN a task has a due date THEN the system SHALL auto-create a reminder 1 hour before the due time.
2. WHEN a user sets a custom reminder THEN the system SHALL create a Reminder record.
3. WHEN triggerAt arrives AND the app is open THEN the system SHALL show an in-app notification.
4. WHEN triggerAt arrives AND the user has granted browser permission THEN the system SHALL also fire a browser notification.
5. WHEN a user clicks a notification THEN the system SHALL navigate to the relevant task or idea page.
6. WHEN a notification has been dismissed THEN the system SHALL mark the reminder as fired.

### R35 — Smart Lists / Saved Filters
**User Story:** As a power user, I want saved filter views across tasks so I can quickly access important views.

#### Data Model
```
SmartList
 ├── id, userId, name
 ├── icon? (emoji or icon name string)
 ├── filters: JSON (e.g. { "priority": "HIGH", "projectId": "...", "dueBefore": "..." })
 ├── sortBy?: string, sortOrder?: "asc" | "desc"
 ├── createdAt
```

#### UI
- `/smart-lists` — list of saved filter views, each with name and icon
- "Save current filter" button on the tasks page that captures the active filter/sort state
- Clicking a smart list navigates to tasks with that filter applied
- Edit/rename/delete from a three-dot menu per smart list
- Reorder by drag handle

#### Acceptance Criteria
1. WHEN a user saves the current filter THEN the system SHALL create a SmartList record with the filter JSON.
2. WHEN a user clicks a smart list THEN the system SHALL navigate to the tasks page with those filters applied.
3. WHEN a user deletes a smart list THEN the system SHALL remove it without affecting the underlying tasks.
4. WHEN no smart lists exist THEN the system SHALL show an empty state with a prompt to save a filter.

### R36 — Habits & Streaks
**User Story:** As a self-improvement minded user, I want to track daily habits with streaks to stay consistent.

#### Data Model
```
Habit
 ├── id, userId, name, description?
 ├── frequency: "daily" | "weekly" | "weekdays"
 ├── color (string, hex)
 ├── active: boolean
 ├── createdAt

HabitLog
 ├── id, habitId, date (ISO date, no time)
 ├── completed: boolean
 ├── note?
 ├── createdAt
```

#### UI
- `/habits` — list view with:
  - Today's checkbox column per habit
  - Streak badge: 🔥 5 days
  - Completion rate: "76% this week"
  - Color-coded dot per habit
- Weekly calendar view per habit — click a date to toggle completion
- Add/edit habit form with fields: name, description, frequency, color picker
- Dashboard widget: today's habit completion count "3/5 habits done"

#### Acceptance Criteria
1. WHEN a user navigates to `/habits` THEN the system SHALL display a list of habits with today's checkboxes.
2. WHEN a user checks a habit as complete THEN the system SHALL create or update the HabitLog for today.
3. WHEN a habit is checked for N consecutive days THEN the system SHALL compute and display the current streak.
4. WHEN a weekday habit is unchecked on Saturday THEN the system SHALL NOT count Saturday toward the streak.
5. WHEN a habit has a 0% week THEN the system SHALL display a gentle encouragement message.

### R37 — Focus Sounds / White Noise
**User Story:** As a focus-oriented user, I want ambient sounds during focus sessions to improve concentration.

#### Data Model
- No new database models — preferences stored in local state or user settings

#### UI
- Built into the `/focus` page as a collapsible sound panel
- Sound presets:
  - 🌧️ Rain
  - 🌲 Forest
  - 🌊 Ocean
  - ❄️ White Noise
  - ☕ Coffee Shop
  - 🔇 Silence
- Select a preset to play, click again to stop
- Volume slider
- Persist last selected preset and volume in localStorage

#### Technical
- Uses Web Audio API with `AudioContext` and `OscillatorNode` / `BiquadFilterNode` for programmatic sound generation — no audio files required
- Rain: layered noise with low-pass filter
- Forest: noise with band-pass filter + random chirp oscillators
- Ocean: low-frequency oscillator modulated noise
- White Noise: flat noise buffer looped
- Coffee Shop: noise with moderate filtering + random short bursts
- All sounds run through a `GainNode` for volume control

#### Acceptance Criteria
1. WHEN a user opens the sound panel THEN the system SHALL display the six preset buttons.
2. WHEN a user selects a preset THEN the system SHALL generate and play the sound using Web Audio API.
3. WHEN a user adjusts the volume slider THEN the system SHALL change the gain in real-time.
4. WHEN a user switches presets THEN the system SHALL stop the current sound and start the new one.
5. WHEN the /focus page is closed THEN the system SHALL stop all sounds.

### R38 — Stopwatch
**User Story:** As a user, I want a simple stopwatch for quick time tracking.

#### UI
- `/stopwatch` — dedicated page with:
  - Large time display: `HH:MM:SS.mm` (hours, minutes, seconds, centiseconds)
  - Start / Stop / Lap / Reset buttons
  - Lap times list below the timer, newest at top
  - Optional export button — copies lap data as CSV to clipboard
- Keyboard shortcuts: Space = Start/Stop, L = Lap, R = Reset
- Time stored in-memory during session; no persistence required (use FocusSession for recorded tracking)

#### Acceptance Criteria
1. WHEN a user navigates to `/stopwatch` THEN the system SHALL display the time at 00:00:00.00 with a Start button.
2. WHEN a user clicks Start THEN the system SHALL begin counting up in centisecond increments.
3. WHEN a user clicks Lap THEN the system SHALL record the current split time and display it in the lap list.
4. WHEN a user clicks Stop THEN the system SHALL pause the timer.
5. WHEN a user clicks Reset THEN the system SHALL reset to 00:00:00.00 and clear lap times.
6. WHEN a user clicks Export THEN the system SHALL copy lap data as CSV to the clipboard.

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
