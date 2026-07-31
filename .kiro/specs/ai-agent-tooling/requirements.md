# Requirements Document — AI Agent & Tooling

## Introduction

The **AI Agent & Tooling** system extends the Command Center's existing DeepSeek V4 AI integration with a tool-calling layer that allows the AI to interact with both internal dashboard data (projects, tasks, transcriptions, scripts, etc.) and external services (Google Calendar, Gmail, etc. via MCP/Zapier). Instead of the AI being limited to generating script drafts, it becomes a full conversational assistant that can read, create, and modify data across the dashboard, and take actions on external services — all through natural language.

The system will be built in phases, starting with internal tool calling, then adding external MCP server connections.

---

## Requirements

### R1 — Tool Registry
**User Story:** As a developer, I want a centralized registry of all AI-callable tools, so that new tools can be added without modifying the AI agent code.

#### Acceptance Criteria
1. WHEN the system starts THEN it SHALL load all registered tools from a tool registry.
2. WHEN a tool is added to the registry THEN the AI SHALL be able to discover and call it.
3. EACH tool in the registry SHALL have a name, description, and input JSON Schema.
4. TOOLS SHALL be grouped into two categories: Internal (System) and External (MCP/Zapier).
5. WHEN the AI receives a request THEN it SHALL select the appropriate tool based on the tool name and description.

### R2 — Internal Tool Definitions
**User Story:** As a user, I want the AI to be able to read and modify my dashboard data (projects, tasks, transcriptions, ideas) through natural language.

#### Acceptance Criteria
1. WHEN I ask the AI to "show my projects" THEN the system SHALL call the `search_projects` tool and return the results.
2. WHEN I ask the AI to "add a task to project X" THEN the system SHALL call the `create_task` tool with the appropriate parameters.
3. WHEN I ask the AI to "mark task X as done" THEN the system SHALL call the `update_task` tool.
4. WHEN I ask the AI to "transcribe this reel" THEN the system SHALL call a transcription tool (or route to the existing transcriber flow).

The following internal tools SHALL be available:

| Tool | Description | Reads/Writes |
|------|-------------|-------------|
| `search_projects` | Search projects by name, status, or list all | Read |
| `get_project` | Get a single project with tasks, notes, links | Read |
| `get_project_tasks` | Get tasks for a project, filter by status | Read |
| `create_task` | Create a new task (title, priority, dueDate, projectId) | Write |
| `update_task` | Update task title, status, priority, due date | Write |
| `delete_task` | Delete a task | Write |
| `search_transcriptions` | Search saved transcriptions by text or title | Read |
| `get_transcription` | Get a single transcription with full text and segments | Read |
| `create_idea` | Create a new idea in Idea Hub | Write |
| `get_ideas` | List ideas, filter by status or tags | Read |
| `promote_idea` | Promote an idea to a Project or Script | Write |
| `get_scripts` | List saved scripts | Read |
| `generate_script` | Generate a script draft using AI with optional persona | Write |
| `send_email` | Send an email via Brevo integration | Write |
| `get_principles` | List Key Principles | Read |
| `get_styles` | List Script Styles | Read |

### R3 — External Tool Integration (MCP / Zapier)
**User Story:** As a user, I want the AI to be able to interact with external services like my calendar and email through natural language.

#### Acceptance Criteria
1. WHEN the user configures a Zapier MCP connection THEN the system SHALL register all available tools from that MCP server.
2. WHEN I ask the AI to "add an event to my calendar tomorrow at 3pm" THEN the system SHALL call the appropriate external tool to create a calendar event.
3. WHEN I ask the AI to "check my email for unread messages" THEN the system SHALL call the appropriate external tool.
4. WHEN an external MCP server is unreachable THEN the system SHALL report the error to the user.
5. EXTERNAL tools SHALL be distinguished from internal tools in the UI (the user should know when data is going to an external service).

The following external tools SHALL be available initially (via Zapier MCP or direct MCP servers):

| Tool | Description | Service |
|------|-------------|---------|
| `add_calendar_event` | Add an event to Google Calendar | Google Calendar |
| `get_calendar_events` | List upcoming calendar events | Google Calendar |
| `send_gmail` | Send an email via Gmail | Gmail |
| `get_gmail_messages` | List/search Gmail messages | Gmail |
| `create_google_doc` | Create a new Google Doc | Google Docs |

### R4 — MCP Client Integration
**User Story:** As a developer, I want a standardized way to connect MCP servers for external tool access.

#### Acceptance Criteria
1. WHEN an MCP server URL and credentials are configured THEN the system SHALL establish a connection to that server.
2. WHEN connected THEN the system SHALL discover and register all tools exposed by the MCP server.
3. WHEN a tool call is routed to an MCP server THEN the system SHALL send the call with the correct parameters and return the result.
4. IF an MCP connection fails THEN the system SHALL attempt to reconnect.
5. MCP server configuration SHALL be stored in the existing ServiceIntegrations model (reusing the API Key Store for credentials).

### R5 — Chat / Command Interface
**User Story:** As a user, I want a chat-like interface where I can type natural language commands for the AI agent.

#### Acceptance Criteria
1. WHEN a user navigates to the AI chat THEN the system SHALL display a chat-style interface with message history.
2. WHEN a user types a message THEN the system SHALL send it to the AI agent with available tool definitions.
3. WHEN the AI calls a tool THEN the system SHALL execute it and return the result to the AI.
4. WHEN the AI responds THEN the system SHALL display the response in the chat.
5. CHAT history SHALL persist for the current session.
6. WHEN a tool call modifies data THEN the system SHALL confirm the action with the user before executing (for destructive operations).
7. THE chat interface SHALL support markdown rendering in responses.

### R6 — Tool-Calling Architecture
**User Story:** As a user, I want the AI to accurately interpret my requests and call the right tools.

#### Acceptance Criteria
1. WHEN the AI receives a user message THEN the system SHALL include all available tool definitions in the AI prompt.
2. THE AI SHALL use DeepSeek V4's function-calling capability to select and parameterize tool calls.
3. WHEN the AI returns a tool call THEN the system SHALL validate the parameters against the tool's JSON Schema.
4. WHEN validation passes THEN the system SHALL execute the tool.
5. WHEN the tool returns a result THEN the system SHALL send it back to the AI for natural language formatting.
6. IF no tool matches the user's request THEN the system SHALL fall back to plain AI chat.

### R7 — Security & Scoping
**User Story:** As a user, I want to be sure the AI agent only accesses my data and requires confirmation for sensitive actions.

#### Acceptance Criteria
1. ALL tool calls SHALL be scoped to the authenticated user's data only.
2. WRITE operations (create, update, delete) SHALL require user confirmation before execution.
3. EXTERNAL tool calls SHALL display a warning indicating data is going to an external service.
4. MCP server credentials SHALL be stored encrypted in the API Key Store.
5. THE system SHALL log all tool calls for audit purposes.
6. USERS SHALL be able to revoke MCP server access at any time.

### R8 — Dashboard Integration
**User Story:** As a user, I want to invoke the AI agent from anywhere in the dashboard, not just a dedicated chat page.

#### Acceptance Criteria
1. WHEN a user is on the Projects page THEN they SHALL be able to ask the AI about their projects.
2. WHEN a user is on the Tasks tab THEN they SHALL be able to ask the AI to create or modify tasks.
3. THE AI agent SHALL be accessible from a floating action button or a collapsible sidebar panel.
4. THE AI context SHALL include the current page/module the user is viewing.
