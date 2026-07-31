# Design Document — Command Center

## Overview

The Command Center is a Next.js 14+ dashboard that centralizes the user's business operations, content creation tools, personal productivity, and secure credential management. It uses a modular architecture where each feature is a self-contained route within the authenticated dashboard shell.

The design follows a **data-first approach**: all modules share the same database (SQLite via Prisma), the same authentication layer (Auth.js), and the same UI component system (shadcn/ui + Tailwind). The Python-based Reel Transcriber runs as a sidecar microservice, proxied through a Next.js API route.

---

## Architecture

```mermaid
graph TD
    Client[Browser] --> NextJS[Next.js App]
    NextJS --> Auth[Auth.js - Session Mgmt]
    NextJS --> Prisma[Prisma ORM]
    Prisma --> SQLite[(SQLite Database)]
    NextJS --> Crypto[Web Crypto API<br/>Client-Side Encryption]
    
    subgraph "External"
        Transcriber[Python FastAPI<br/>Reel Transcriber]
    end
    
    NextJS -.->|/api/transcribe proxy| Transcriber
    
    subgraph "Next.js App Router"
        AuthRoutes["/(auth)<br/>Login / Register"]
        DashRoutes["/(dashboard)<br/>All Modules"]
    end
    
    Auth --> AuthRoutes
    Auth --> DashRoutes
```

## Directory Structure

```
command-center/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx         # Centered layout for auth pages
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # Sidebar + header layout
│   │   │   ├── page.tsx           # Dashboard overview / home
│   │   │   ├── passwords/
│   │   │   │   └── page.tsx
│   │   │   ├── transcriber/
│   │   │   │   └── page.tsx
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx       # Invoice list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx   # Invoice detail
│   │   ├── todos/
│   │   │   └── page.tsx
│   │   ├── matrix/
│   │   │   └── page.tsx
│   │   ├── focus/
│   │   │   └── page.tsx
│   │   ├── habits/
│   │   │   └── page.tsx
│   │   ├── smart-lists/
│   │   │   └── page.tsx
│   │   └── stopwatch/
│   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── passwords/
│   │   │   │   └── route.ts       # CRUD for password entries
│   │   │   ├── invoices/
│   │   │   │   └── route.ts       # CRUD for invoices
│   │   │   ├── todos/
│   │   │   │   └── route.ts       # CRUD for todos
│   │   │   ├── reminders/
│   │   │   │   └── route.ts       # CRUD for reminders
│   │   │   ├── habits/
│   │   │   │   └── route.ts       # CRUD for habits + habit logs
│   │   │   ├── smart-lists/
│   │   │   │   └── route.ts       # CRUD for saved filter views
│   │   │   ├── focus/
│   │   │   │   └── route.ts       # Focus session tracking & stats
│   │   │   └── transcribe/
│   │   │       └── route.ts       # Proxies to Python microservice
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── overview-cards.tsx
│   │   ├── passwords/
│   │   │   ├── vault-list.tsx
│   │   │   ├── add-credential-dialog.tsx
│   │   │   └── master-password-prompt.tsx
│   │   ├── transcriber/
│   │   │   ├── url-input.tsx
│   │   │   └── transcript-result.tsx
│   │   ├── invoices/
│   │   │   ├── invoice-list.tsx
│   │   │   ├── invoice-form.tsx
│   │   │   └── invoice-card.tsx
│   │   ├── todos/
│   │   │   ├── todo-list.tsx
│   │   │   ├── todo-item.tsx
│   │   │   ├── add-todo-form.tsx
│   │   │   ├── tag-selector.tsx
│   │   │   └── tag-manager.tsx
│   │   ├── matrix/
│   │   │   ├── eisenhower-matrix.tsx
│   │   │   ├── matrix-quadrant.tsx
│   │   │   └── matrix-task-card.tsx
│   │   ├── focus/
│   │   │   ├── focus-timer.tsx
│   │   │   ├── circular-progress.tsx
│   │   │   ├── task-selector.tsx
│   │   │   ├── session-counter.tsx
│   │   │   ├── auto-break-mode.tsx
│   │   │   └── focus-sounds.tsx
│   │   ├── habits/
│   │   │   ├── habit-list.tsx
│   │   │   ├── habit-checkbox.tsx
│   │   │   ├── weekly-calendar.tsx
│   │   │   ├── streak-counter.tsx
│   │   │   └── add-habit-form.tsx
│   │   ├── smart-lists/
│   │   │   ├── smart-list-grid.tsx
│   │   │   ├── smart-list-card.tsx
│   │   │   └── saved-filter-dialog.tsx
│   │   ├── stopwatch/
│   │   │   ├── stopwatch-timer.tsx
│   │   │   └── lap-list.tsx
│   │   └── reminders/
│   │       ├── reminder-bell.tsx
│   │       ├── reminder-list.tsx
│   │       └── add-reminder-dialog.tsx
│   ├── lib/
│   │   ├── auth.ts                # Auth.js configuration
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── crypto.ts              # Web Crypto API helpers
│   │   └── utils.ts               # Shared utilities
│   └── middleware.ts              # Route protection
├── instagram-transcriber/         # Python microservice (unchanged)
│   ├── app.py
│   ├── downloader.py
│   ├── transcriber.py
│   └── requirements.txt
├── .env
├── package.json
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── next.config.ts
```

## Data Models (Prisma Schema)

```prisma
enum Priority {
  URGENT_IMPORTANT
  NOT_URGENT_IMPORTANT
  URGENT_NOT_IMPORTANT
  NOT_URGENT_NOT_IMPORTANT
}

enum RepeatInterval {
  DAILY
  WEEKLY
  MONTHLY
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  passwords PasswordEntry[]
  invoices  Invoice[]
  todos     Todo[]
  tags      Tag[]
  reminders Reminder[]
  smartLists SmartList[]
  habits    Habit[]
  focusSessions FocusSession[]
}

model PasswordEntry {
  id                String   @id @default(cuid())
  userId            String
  website           String
  username          String
  encryptedPassword String   // AES-256-GCM ciphertext (base64)
  iv                String   // Initialization vector (base64)
  notes             String?  // Also encrypted (base64)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Invoice {
  id            String        @id @default(cuid())
  userId        String
  clientName    String
  clientEmail   String?
  amount        Float
  dueDate       DateTime?
  description   String?
  status        InvoiceStatus @default(DRAFT)
  invoiceNumber String
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Todo {
  id             String         @id @default(cuid())
  userId         String
  title          String
  description    String?
  dueDate        DateTime?
  completed      Boolean        @default(false)
  priority       Priority?
  repeatInterval RepeatInterval?
  repeatEndDate  DateTime?
  archived       Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags    TodoTag[]
  reminders Reminder[]
  focusSessions FocusSession[]
}

model Tag {
  id     String   @id @default(cuid())
  userId String
  name   String   // e.g. "LuxeRide", "Content", "Personal", "Health", etc.

  user User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  todos TodoTag[]

  @@unique([userId, name]) // no duplicate tags per user
}

model TodoTag {
  todoId String
  tagId  String

  todo Todo @relation(fields: [todoId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([todoId, tagId])
}

model Reminder {
  id        String   @id @default(cuid())
  userId    String
  title     String
  taskId    String?
  dueDate   DateTime
  sent      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  todo Todo? @relation(fields: [taskId], references: [id])
}

model SmartList {
  id        String   @id @default(cuid())
  userId    String
  name      String
  filters   String   // JSON string of filter criteria
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Habit {
  id          String    @id @default(cuid())
  userId      String
  name        String
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs HabitLog[]
}

model HabitLog {
  id        String   @id @default(cuid())
  habitId   String
  date      DateTime // normalized to midnight
  completed Boolean  @default(true)
  createdAt DateTime @default(now())

  habit Habit @relation(fields: [habitId], references: [id], onDelete: Cascade)

  @@unique([habitId, date])
}

model FocusSession {
  id          String    @id @default(cuid())
  userId      String
  taskId      String?
  duration    Int       // in seconds
  type        String    // "focus" or "break"
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  user User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  todo  Todo?   @relation(fields: [taskId], references: [id])
}
```

## Component Tree

```mermaid
graph TD
    RootLayout --> AuthLayout["(auth)/layout.tsx"]
    RootLayout --> DashLayout["(dashboard)/layout.tsx"]
    
    AuthLayout --> LoginPage
    AuthLayout --> RegisterPage
    
    DashLayout --> Sidebar
    DashLayout --> Header
    DashLayout --> {Content}
    
    Sidebar --> NavItems["Home, Passwords,<br/>Transcriber, Invoices,<br/>Todos, Matrix, Focus,<br/>Habits, Smart Lists,<br/>Stopwatch"]
    
    Content --> DashboardHome["Dashboard Home<br/>Overview Cards"]
    Content --> PasswordsPage
    Content --> TranscriberPage
    Content --> InvoicesPage
    Content --> TodosPage
    Content --> MatrixPage
    Content --> FocusPage
    Content --> HabitsPage
    Content --> SmartListsPage
    Content --> StopwatchPage
    
    DashboardHome --> StatCards["Total Invoices<br/>Pending Tasks<br/>Recent Activity"]
    
    Header --> ReminderBell
    
    PasswordsPage --> MasterPasswordPrompt
    PasswordsPage --> VaultList
    PasswordsPage --> AddCredentialDialog
    
    TranscriberPage --> URLInput
    TranscriberPage --> TranscriptResult
    
    InvoicesPage --> InvoiceList
    InvoicesPage --> InvoiceForm
    InvoicesPage --> InvoiceDetail
    
    TodosPage --> AddTodoForm
    TodosPage --> TodoList
    TodosPage --> TagManager
    TodoList --> TodoItem
    AddTodoForm --> TagSelector["TagSelector
Create or pick existing tags"]
    
    MatrixPage --> EisenhowerMatrix
    EisenhowerMatrix --> Q1["Quadrant: Do<br/>Urgent + Important"]
    EisenhowerMatrix --> Q2["Quadrant: Schedule<br/>Not Urgent + Important"]
    EisenhowerMatrix --> Q3["Quadrant: Delegate<br/>Urgent + Not Important"]
    EisenhowerMatrix --> Q4["Quadrant: Eliminate<br/>Not Urgent + Not Important"]
    Q1 --> MatrixTaskCard
    Q2 --> MatrixTaskCard
    Q3 --> MatrixTaskCard
    Q4 --> MatrixTaskCard
    
    FocusPage --> FocusTimer
    FocusPage --> TaskSelector
    FocusPage --> SessionCounter
    FocusPage --> FocusSounds
    FocusTimer --> CircularProgress
    FocusTimer --> AutoBreakMode
    
    HabitsPage --> HabitList
    HabitsPage --> AddHabitForm
    HabitList --> HabitCheckbox
    HabitList --> WeeklyCalendar
    HabitList --> StreakCounter
    
    SmartListsPage --> SmartListGrid
    SmartListGrid --> SmartListCard
    SmartListsPage --> SavedFilterDialog
    
    StopwatchPage --> StopwatchTimer
    StopwatchPage --> LapList
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS
    participant AuthJS
    participant Prisma
    
    Note over User,Prisma: Registration
    User->>NextJS: POST /api/auth/register {email, password}
    NextJS->>Prisma: Check if email exists
    Prisma-->>NextJS: No existing user
    NextJS->>NextJS: Hash password (bcrypt)
    NextJS->>Prisma: Create user
    Prisma-->>NextJS: User created
    NextJS-->>User: Success + auto-login
    
    Note over User,Prisma: Login
    User->>NextJS: POST /api/auth/callback/credentials
    NextJS->>AuthJS: Validate credentials
    AuthJS->>Prisma: Find user by email
    Prisma-->>AuthJS: User found
    AuthJS->>AuthJS: Compare password hash
    AuthJS-->>NextJS: Session JWT
    NextJS-->>User: Redirect to dashboard
    
    Note over User,Prisma: Route Protection
    User->>NextJS: GET /dashboard/...
    NextJS->>NextJS: middleware.ts checks session
    alt No session
        NextJS-->>User: Redirect to /login
    else Valid session
        NextJS-->>User: Render protected page
    end
```

## Password Manager Encryption Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextJS
    participant Prisma
    
    Note over User,Prisma: Unlock Vault
    User->>Browser: Enter master password
    Browser->>Browser: Derive key via PBKDF2<br/>Store in memory only (not sent to server)
    
    Note over User,Prisma: Save a credential
    User->>Browser: Fill form (website, username, password, notes)
    Browser->>Browser: Encrypt password + notes with AES-256-GCM<br/>using derived key
    Browser->>NextJS: POST /api/passwords<br/>{website, username, encryptedPassword, iv, encryptedNotes}
    NextJS->>Prisma: Store encrypted data
    Prisma-->>NextJS: Saved
    NextJS-->>User: Success
    
    Note over User,Prisma: View credentials
    User->>Browser: Open vault
    Browser->>NextJS: GET /api/passwords
    NextJS->>Prisma: Fetch all encrypted entries for user
    Prisma-->>NextJS: Encrypted data
    NextJS-->>Browser: Return encrypted entries
    Browser->>Browser: Decrypt each entry using derived key (in memory)
    Browser->>User: Display decrypted credentials
```

## Transcriber Integration

Two options exist:

**Option A — Microservice (Recommended for Phase 1)**
- Keep the Python FastAPI server running on a local port (e.g., 8001)
- Next.js API route `/api/transcribe` proxies the request to `http://localhost:8001/api/transcribe`
- Pros: Zero changes to the working Python code, separation of concerns
- Cons: Requires Python server to be running

**Option B — Port to TypeScript**
- Rewrite download + transcribe logic in TypeScript using `yt-dlp-exec` and `whisper.cpp` bindings
- Pros: Fully self-contained in Next.js
- Cons: Rewriting working code, whisper.cpp bindings are less mature

**Recommendation:** Start with Option A (microservice). Later, if needed, we can containerize with Docker Compose so both servers start together.

## Error Handling Strategy

| Layer | Approach |
|-------|----------|
| **API Routes** | Try/catch with structured error responses `{ error: string, code: string }` |
| **Server Actions** | Return `{ success: boolean, error?: string }` objects |
| **Client Components** | Toast notifications for success/error feedback (sonner) |
| **Auth** | Auth.js handles errors; custom error pages for 401/403 |
| **Transcriber** | Network error → "Transcriber service unavailable" message; Validation → "Invalid URL" |

## Dynamic Tags (Todo System)

Tags are many-to-many with todos, meaning one task can have multiple tags (e.g. "LuxeRide" + "Urgent").

**Tag workflow:**
1. When adding/editing a todo, a tag input shows existing tags with autocomplete
2. User can type a new tag name → it gets created on save
3. Clicking a tag badge filters the todo list to that tag
4. A small "Manage Tags" section lets users rename or delete tags they've created

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB
    
    Note over User,DB: Creating a task with tags
    User->>UI: Type task + select "LuxeRide" tag + create new "Urgent" tag
    UI->>API: POST /api/todos { title, description, tags: ["LuxeRide", "Urgent"] }
    API->>DB: Find-or-create tags for user
    API->>DB: Create todo + link tags via TodoTag
    DB-->>API: Saved
    API-->>UI: Todo with tags
    UI-->>User: Display task with tag badges
    
    Note over User,DB: Filtering by tag
    User->>UI: Click "LuxeRide" badge
    UI->>API: GET /api/todos?tag=LuxeRide
    API->>DB: Query todos with that tag
    DB-->>API: Filtered todos
    API-->>UI: Display filtered list
```

## Page Layouts

### Auth Pages (Login / Register)
- Centered card layout
- Minimal — just the form + branding
- Links to toggle between login/register

### Dashboard Layout
```
┌─────────────────────────────────────┐
│  Header: Logo | Search | User Menu   │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │   Page Content           │
│          │                          │
│ 🏠 Home     │                          │
│ 🔐 Vault    │                          │
│ 🎬 Reels    │                          │
│ 📄 Invs     │                          │
│ ✅ Todos    │                          │
│ 📊 Matrix   │                          │
│ ⏱ Focus    │                          │
│ 🔄 Habits   │                          │
│ 🏷 SmartLists│                          │
│ ⏲ Stopwatch│                          │
│          │                          │
└──────────┴──────────────────────────┘
```

### Dashboard Home
- Welcome message with user's name
- Summary cards: Total Invoices, Pending Todos, Recent Activity
- Quick-action buttons: "New Invoice", "Add Task", "Transcribe Reel"

### Responsive Behavior
- **Desktop (>768px)**: Sidebar always visible on the left
- **Mobile (<768px)**: Sidebar hidden behind hamburger toggle; content takes full width
- Layout uses Tailwind's `md:` breakpoint

## UI Design System

- **Theme**: Dark mode by default (matching the reeltext receipt-style aesthetic)
- **Colors**: Dark backgrounds, green accents (from the reeltext template), amber for warnings
- **Components**: shadcn/ui with custom Command Center theme
- **Font**: Inter (UI) with JetBrains Mono for code/transcript display

```css
:root {
  --background: #0b0e0c;
  --panel: #10140f;
  --border: #1e2a1c;
  --foreground: #d8e4d0;
  --muted: #6b7a63;
  --accent: #7fd858;
  --warning: #ffb347;
  --danger: #ff6b5e;
}
```

## Testing Strategy

- **Unit tests**: Utility functions (crypto, formatting, validation)
- **Component tests**: Critical UI components (sidebar, todo list, invoice form)
- **API tests**: CRUD endpoints for each module
- **E2E**: Auth flow (register → login → protected route access)

Phase 1 focuses on **manual testing** during development, with unit tests for the crypto module (critical for security).

## Phase 6 — Productivity & Focus

### 1. Eisenhower Matrix (`/matrix`)

A 2×2 quadrant view of tasks based on priority and urgency:

- **Do** (Urgent + Important) — Tasks with high priority and due within 48 hours
- **Schedule** (Not Urgent + Important) — High priority tasks with distant due dates
- **Delegate** (Urgent + Not Important) — Low priority tasks due within 48 hours
- **Eliminate** (Not Urgent + Not Important) — Low priority, no deadline

**Implementation:**
- Quadrants are derived dynamically from the existing Todo model using `priority` enum + `dueDate` proximity
- Tasks can be dragged between quadrants via drag-and-drop, which updates their `priority` and/or `dueDate`
- Each quadrant is a scrollable column with todo cards
- Uses `@hello-pangea/dnd` for drag-and-drop (maintained fork of react-beautiful-dnd)

```mermaid
graph TD
    MatrixPage["/matrix page.tsx"] --> EisenhowerMatrix[EisenhowerMatrix
Client Component]
    EisenhowerMatrix --> Q1["Do Quadrant
urgent + important"]
    EisenhowerMatrix --> Q2["Schedule Quadrant
not urgent + important"]
    EisenhowerMatrix --> Q3["Delegate Quadrant
urgent + not important"]
    EisenhowerMatrix --> Q4["Eliminate Quadrant
not urgent + not important"]
    Q1 --> TaskCard[MatrixTaskCard
draggable]
    Q2 --> TaskCard
    Q3 --> TaskCard
    Q4 --> TaskCard
```

---

### 2. Focus Timer (`/focus`)

A Pomodoro-style focus timer with the following features:

**Timer Controls:**
- Start / Pause / Reset with circular SVG progress indicator
- Duration presets: Focus (25m), Short Break (5m), Long Break (15m)
- Auto-break mode: automatically transitions to break after a focus session completes
- Session counter shows completed pomodoros for the day

**Task Integration:**
- Task selector dropdown to associate a focus session with a specific todo
- Focus sessions are logged to the `FocusSession` model for analytics

**Notifications:**
- Browser Notification API sends a notification when timer completes
- Web Audio API beep sound plays on completion (no external audio files needed)

**Dashboard Widget:**
- Today's total focus time displayed on the dashboard home overview cards
- Query: `SUM(duration) WHERE type='focus' AND completedAt IS TODAY`

**Settings:**
- User-configurable duration presets stored in a settings store (localStorage or DB)

---

### 3. Recurring Tasks

Adds repeatability to the existing Todo model:

- `repeatInterval` enum: `DAILY | WEEKLY | MONTHLY`
- `repeatEndDate`: optional date after which no more repeats are created
- When a recurring task is marked complete, a new Todo is auto-created with:
  - Same title, description, tags, priority
  - `dueDate` advanced by the interval (e.g., +1 day, +1 week, +1 month)
  - New `id` and `createdAt`
- The original completed task is archived (`archived: true`) rather than deleted
- Users can skip recurrence on completion (completes without creating next)

**Completion workflow:**
```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB
    
    User->>UI: Mark recurring todo complete
    UI->>UI: Show dialog "Complete & create next?" / "Complete once"
    User->>UI: "Complete & create next"
    UI->>API: POST /api/todos/{id}/complete { repeat: true }
    API->>DB: Set original todo.archived = true
    API->>DB: Create new todo with advanced dueDate
    DB-->>API: Both updated
    API-->>UI: Return new todo
    UI-->>User: Original archived, new task visible
```

---

### 4. Reminders & Notifications

Bell icon in the header showing unread reminder count. Click opens a dropdown with upcoming reminders.

**Reminder Model:**
- Linked to a specific todo (`taskId`) or standalone
- `dueDate` determines when to notify
- `sent` boolean tracks if notification has been fired

**Notification mechanics:**
- On page load, a client-side interval checks for due reminders
- Uses the **Browser Notification API** for system-level notifications
- Auto-creates a reminder 1 hour before a todo's due date when the todo is created/saved (configurable)
- API route: `GET /api/reminders` fetches upcoming + overdue, `POST /api/reminders` creates, `PATCH /api/reminders/{id}` marks sent

```mermaid
sequenceDiagram
    participant Browser
    participant API
    participant DB
    
    Note over Browser,DB: On dash load + periodic check
    Browser->>API: GET /api/reminders?upcoming=true
    API->>DB: Query reminders where dueDate <= now + 5min AND sent = false
    DB-->>API: Due reminders
    API-->>Browser: Return list
    Browser->>Browser: For each, fire Notification API + mark sent
    Browser->>API: PATCH /api/reminders { ids: [...] }
    API->>DB: Mark sent = true
```

---

### 5. Smart Lists (`/smart-lists`)

Saved filter views for todos. Users can save arbitrary filter combinations as a named SmartList and recall them later.

**Filter criteria (stored as JSON):**
- Tag(s)
- Priority
- Completed / Incomplete
- Due date range
- Recurring / Non-recurring

**Page layout:**
- Grid of SmartList cards showing name and task count
- Click opens a pre-filtered TodoList view
- Manage dialog to create, edit, or delete SmartLists

---

### 6. Habits & Streaks (`/habits`)

A habit tracker with daily check-ins, streak counting, and a weekly calendar view.

**Models:**
- `Habit`: name, description — belongs to User
- `HabitLog`: habitId, date (normalized to midnight UTC), completed (boolean) — unique on `[habitId, date]`

**Page features:**
- List of habits with a checkbox for today
- Weekly calendar view (7-day grid) showing green/empty cells per habit
- Streak counter: consecutive days with a completed log for each habit
- Add habit form (name + optional description)
- Delete habit (cascades to logs)

```mermaid
graph TD
    HabitsPage["/habits page.tsx"] --> HabitList[HabitList
Client Component]
    HabitsPage --> AddHabitForm[AddHabitForm]
    HabitList --> HabitCheckbox[HabitCheckbox
toggle today's log]
    HabitList --> WeeklyCalendar[WeeklyCalendar
7-day rolling grid]
    HabitList --> StreakCounter[StreakCounter
current streak badge]
```

---

### 7. Focus Sounds

Ambient sound player embedded in the Focus Timer panel. Uses the **Web Audio API** to generate procedural sounds — no audio files or external dependencies.

**Sound types (all synthesized):**
- **Rain** — filtered noise with random amplitude modulation
- **Brown Noise** — low-pass filtered noise
- **Forest** — noise + occasional frequency sweeps for bird-like tones
- **White Noise** — unfiltered noise
- **Silence** (no sound)

**Controls:**
- Volume slider
- Sound type selector
- Auto-start with focus timer (configurable in settings)

---

### 8. Stopwatch (`/stopwatch`)

A precision stopwatch page with lap timing.

**Features:**
- Start / Stop / Reset controls
- Lap button captures the current elapsed time and stores it in a lap list
- Laps display: lap number, split time (time since previous lap), and total elapsed time at capture
- Lap times are stored in component state (in-memory, not persisted to DB)
- Keyboard shortcuts: Space = Start/Stop, L = Lap

---

### Dashboard Home Updates

The dashboard overview cards gain new widgets:
- **Today's Focus Time** — total minutes of completed focus sessions
- **Upcoming Reminders** — count of reminders due within the next hour
- **Habit Streaks** — number of habits currently on a streak (≥2 days)

### New Navigation Items

The sidebar adds entries for all new pages:

```
│ 📊 Matrix   │
│ ⏱ Focus    │
│ 🔄 Habits   │
│ 🏷 SmartLists│
│ ⏲ Stopwatch│
```

## Dependencies (Key Packages)

```json
{
  "next": "^14.2",
  "react": "^18.3",
  "next-auth": "^5.0",
  "@prisma/client": "^5.x",
  "prisma": "^5.x",
  "bcryptjs": "^2.4",
  "tailwindcss": "^3.4",
  "@radix-ui/react-dialog": "^1.x",
  "@radix-ui/react-dropdown-menu": "^2.x",
  "@radix-ui/react-select": "^2.x",
  "lucide-react": "^0.x",
  "class-variance-authority": "^0.7",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x",
  "sonner": "^1.x",
  "zod": "^3.x"
}
```
