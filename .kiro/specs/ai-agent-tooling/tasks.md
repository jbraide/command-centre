# Implementation Plan — AI Agent & Tooling

## Prerequisites

This feature depends on **Phase 5** of the main Command Center plan and assumes R30 (Zapier MCP Service Integration) is built. The following infrastructure must be in place:

- Next.js App Router with API route support
- Prisma ORM with existing models for Projects, Tasks, Transcriptions, Ideas, Scripts, Key Principles, Script Styles, Brevo Email, API Key Store, and Service Integrations
- DeepSeek V4 API client (existing from Script Writer)
- Authentication middleware (NextAuth or similar)
- Existing sidebar navigation component
- Brevo email integration
- Existing `lib/ai/` directory structure

---

- [x] **1. Set up database models for chat**
  - Add `ChatSession` model to Prisma schema (id, userId, title, createdAt, updatedAt)
  - Add `ChatMessage` model to Prisma schema (id, sessionId FK, role, content, toolCalls JSON, createdAt)
  - Run `prisma generate` and `prisma db push`
  - Create `lib/ai/db.ts` — chat-specific query helpers (createSession, getSession, getMessages, saveMessage, deleteSession, listSessions)
  - _Requirements: R1 (AC 1), R5 (AC 1, 5)_

- [x] **2. Implement Tool Registry**
  - Create `lib/ai/tool-registry.ts` — central registry with:
    - `registerTool(tool)` — register a single tool
    - `getTools()` — get all registered tools
    - `getTool(name)` — get a single tool by name
    - `getToolsByCategory(category)` — filter by internal/external
  - Define `ToolDefinition` interface: name, description, category ('internal' | 'external'), inputSchema (JSON Schema object), handler function signature
  - Implement Zod-based input validation for each tool's schema
  - Create tool registry singleton that loads all registered tools on startup
  - _Requirements: R1 (all AC), R6 (AC 1)_

- [x] **3. Implement Internal Tools**
  - Create `lib/ai/internal-tools.ts` with handler functions for all internal tools
  - Each tool handler calls Prisma directly (scoped to authenticated user via userId passed in context)
  - Implement JSON Schema for each tool's input parameters
  - Register all internal tools with the tool registry on initialization

  - [x] 3.1 `search_projects` — query projects by name/status, returns list with metadata
  - [x] 3.2 `get_project` — get single project with tasks, notes, links
  - [x] 3.3 `get_tasks` — get tasks for a project, filter by status
  - [x] 3.4 `create_task` — create a new task (title, priority, dueDate, projectId)
  - [x] 3.5 `update_task` — update task title, status, priority, due date
  - [x] 3.6 `delete_task` — delete a task by id
  - [x] 3.7 `get_transcriptions` — list transcriptions, optional limit/search
  - [x] 3.8 `get_notes` — get notes for a project
  - [x] 3.9 `get_links` — get links for a project
  - [x] 3.10 `get_ideas` — list ideas, filter by status or tags
  - [x] 3.11 `promote_idea` — promote an idea to a Project or Script
  - [x] 3.12 `archive_idea` — archive an idea
  - [x] 3.13 `get_scripts` — list saved scripts
  - [x] 3.14 `generate_script` — generate a script draft using AI with optional persona
  - [x] 3.15 `get_personas` / `get_persona` — list/get creator personas
  - [x] 3.16 `get_principles` — list Key Principles
  - [x] 3.17 `get_styles` — list Script Styles
  - [x] 3.18 `get_dashboard` — aggregated dashboard counts
  - [x] 3.19 `create_project` / `update_project` / `delete_project` — project CRUD
  - [x] 3.20 `create_note` / `delete_note` — note CRUD
  - [x] 3.21 `create_link` / `delete_link` — link CRUD
  - [x] 3.22 `create_persona_lesson` / `create_persona_example` — persona data management
  - [x] 3.23 `get_api_keys` — list API keys
  - [x] 3.24 `get_integrations` — list service integrations

  - _Requirements: R2 (all AC), R6 (AC 2, 3, 4, 5)_
  - _Note: The final implementation has 24+ tools (significantly more than the original 16 planned)_

- ~~**4. Implement MCP Client** — Skipped (MCP SDK integration not built; external tools deferred)~~

- [x] **5. Implement Tool Router**
  - Create `lib/ai/tool-router.ts`
  - Single entry point `executeToolCall(toolName, args, userId)` that:
    1. Looks up tool in registry by name
    2. Validates parameters against the tool's JSON Schema using Zod
    3. Routes to internal handler or MCP client based on category
    4. Returns formatted result `{ success: boolean, data: any, error?: string }`
  - Implement timeout handling: 10s for internal tools, 30s for external/MCP tools
  - Log all tool calls with timestamp, tool name, params, success/failure, and latency
  - _Requirements: R1 (AC 2), R6 (AC 2, 3, 4, 5)_

- [x] **6. Implement AI Agent Chat API**
  - Created `app/api/ai/sessions/route.ts`, `app/api/ai/sessions/[id]/messages/route.ts`, `app/api/ai/sessions/[id]/route.ts`
  - Created `app/api/ai/chat/route.ts` with plan-based execution, multi-round tool calling (max 10 rounds × 12 calls), SSE streaming
  - SSE events: `plan`, `step_start`, `step_complete`, `step_retry`, `step_error`, `text`, `done`, `error`
  - Legacy backward-compatible events (`tool_call_start`, `tool_call_end`) also emitted
  - Saves all messages to ChatMessage table
  - Rate limiting implemented: max 10 tool calls per turn, max 10 rounds
  - Fallback to plain chat completion when no tool matches
  - _Requirements: R5 (AC 2, 3, 4), R6 (all AC)_

- [x] **7. Build Chat UI — API integration**
  - Created `hooks/use-ai-chat.ts` — React hook wrapping the chat API:
    - Manage session state (current session, session list)
    - Manage message list with optimistic updates
    - Handle streaming responses via `fetch` + `ReadableStream` (SSE parser)
    - Track loading states (sending, AI thinking, tool executing)
    - Handle errors with AbortError support
    - Persist current session ID in localStorage
    - Handles all SSE event types: `plan`, `step_start`, `step_complete`, `step_retry`, `step_error`, `text`, `tool_call_start`, `tool_call_end`, `done`, `error`
  - _Requirements: R5 (AC 1, 4, 5, 7)_

- [x] **8. Build Chat UI — Page and Components**
  - Created `app/(dashboard)/ai/page.tsx` — full chat page with sidebar + chat area
  - Created `components/ai/chat-sidebar.tsx` — session list with delete
  - Created `components/ai/chat-messages.tsx` — message list with auto-scroll
  - Created `components/ai/chat-input.tsx` — multi-line input with Enter/Shift+Enter
  - Created `components/ai/message-bubble.tsx` — user/assistant messages, Step Tracker, tool calls, markdown rendering
  - Created `components/ai/tool-card.tsx` — step status indicators (pending/running/success/retry/error)
  - Added `/ai` link to sidebar navigation under "AI" group
  - _Requirements: R5 (all AC)_

- ~~**9. Build Floating Chat Trigger** — Skipped (not implemented yet)~~

- ~~**10. Wire MCP Client to Integrations Module** — Skipped (depends on MCP Client task 4)~~

- [x] **11. Security & Scoping**
  - All internal tool handlers scope Prisma queries to `userId` — no cross-user data access
  - Audit logging: all tool calls logged in `ChatMessage.toolCalls` JSON with timestamps
  - Chat API verifies session ownership before processing
  - _Requirements: R7 (all AC)_

- [ ] **12. Testing**

  - **Unit tests:**
    - Test all 16 internal tool handlers with mock Prisma data
    - Test MCP client with a mock MCP server (in-memory)
    - Test tool registry: registration, retrieval, duplicate prevention
    - Test tool router: valid params, invalid params (schema validation failure), timeout, error propagation
    - Test Zod schema validation for every tool's input schema

  - **Integration tests:**
    - Test chat API: single-turn chat, multi-turn conversation, tool call execution, streaming response
    - Test session CRUD API: create, list, get messages, delete
    - Test MCP wiring: connect, discover, call, disconnect flow
    - Test SSE streaming from `/api/ai/chat`

  - **UI tests:**
    - Test chat page rendering with session list and message area
    - Test streaming message rendering (partial content updates)
    - Test tool card states: pending, success, error
    - Test error states: network failure, API error, empty response
    - Test floating chat trigger: open, close, send message

  - **Security tests:**
    - Verify unauthorized API calls return 401/403
    - Verify User A cannot access User B's sessions or data through tool calls
    - Verify write operations without confirmation are rejected
    - Verify MCP credential encryption/decryption round-trip

  - _Requirements: All (R1–R8)_

- [x] **13. Implement Agent Execution Engine**
  - Created `lib/ai/agent.ts` with:
    - `PlanStep` and `ExecutionPlan` types with step status tracking
    - `PlanCallbacks` interface for real-time UI updates
    - `executePlan()` — iterates through plan steps sequentially
    - `executeStep()` — runs each step with up to 3 retries (500ms, 1s, 2s backoff)
    - `autoFixArgs()` — auto-fix parameter normalization (stringified JSON, boolean coercion)
    - `extractSummary()` — smart result summary extraction per tool type
    - AbortSignal support for cancellation
  - Integrated into chat API: `POST /api/ai/chat` creates `ExecutionPlan` from DeepSeek tool calls and passes callbacks for SSE streaming
  - _Requirements: R6 (all AC), R7_
