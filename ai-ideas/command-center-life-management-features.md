# Command Center — Life Management Feature Ideas

Command Center already covers business ops (Projects), content (Reel Transcriber, Script Writer), and security (Password Vault). The ideas below extend it into a full personal life dashboard — the same dark-theme, SQLite/Prisma, Auth.js foundation, just new modules. Ordered roughly by how much value they add for how little they cost to build.

---

## 🧠 1. Idea Hub (Central Capture)

The missing piece that ties everything else together — a single inbox for every stray thought (business idea, content topic, personal to-do) before it's triaged into a Project, a Script, or discarded. This is also the direct answer to your Script Writer request: "paste the topic from my central idea hub" needs somewhere to live first.

**Why it matters:** right now an idea either becomes a Project task (too heavyweight for a half-formed thought) or gets lost. A lightweight capture layer fixes that.

**Data model:**
```
Idea
  ├── title
  ├── rawNotes (freeform text — voice-to-text friendly)
  ├── tags[] (e.g. "business", "content", "personal", "micro-epay")
  ├── status (raw / promoted / archived)
  ├── linkedProjectId? (optional, set when promoted to a Project)
  └── linkedScriptId?  (optional, set when used as a Script Writer input)
```

**UI:**
- `/ideas` — single-column feed, newest first, quick-add bar always visible at top (title + optional tags, Enter to save)
- Each idea card: "Promote to Project" / "Send to Script Writer" / "Archive" quick actions
- Filter by tag, filter by status
- This becomes the topic source in the persona-based Script Writer flow (see the separate Script Writer spec)

---

## 💰 2. Personal Finance Snapshot

Separate from the business-facing Invoices module — this is your own money, not client money.

**Data model:**
```
FinanceAccount (name, type: bank/wallet/savings, currentBalance, currency)
FinanceEntry (accountId, amount, direction: in/out, category, note, date)
```

**UI:**
- Dashboard widget: net position across accounts, updated on manual entry (no bank sync needed for v1 — that's a real project on its own)
- Simple category breakdown (rent, subscriptions, business reinvestment, savings) as a donut chart
- Given you're building Micro E-pay, this is also a good internal dogfooding surface — you could later plug your own virtual card transaction feed in here

---

## 🔁 3. Subscriptions & Recurring Bills Tracker

Small, high-value, easy to ship.

**Data model:**
```
Subscription (name, amount, currency, billingCycle: monthly/yearly, nextDueDate, category, active)
```

**UI:**
- List sorted by next due date, colored badge when due within 7 days
- Dashboard widget: "3 renewals this week — ₦X total"
- Optional: auto-create a Task in Projects when a renewal is coming up, using the existing Task model — no new notification system needed for v1

---

## 🎯 4. Goals & Quarterly Reviews

Right now Projects tracks *what* you're doing; nothing tracks *why* or *whether it's working*.

**Data model:**
```
Goal (title, description, targetDate, status: active/hit/missed, linkedProjectIds[])
ReviewEntry (period: e.g. "2026-Q3", wins, misses, nextFocus, createdAt)
```

**UI:**
- `/goals` — kanban-style: Active / Hit / Missed
- Quarterly review prompt (simple form: "what worked", "what didn't", "what's next") that pulls in stats from Projects/Tasks completed that quarter automatically, so the review isn't a blank page

---

## 📔 5. Daily Journal / Reflection

**Data model:**
```
JournalEntry (date, content, tags[])
```

**UI:**
- `/journal` — calendar-style month view, click a day to write or read
- Deliberately *not* mood-scored or analyzed — keep it a plain, private writing space rather than a tracked metric
- Could reuse the Notes tab's UI pattern from Projects almost directly — cheap to build

---

## 🎙️ 6. Voice Memo Transcription (reuse your existing infra)

You already built a local yt-dlp + faster-whisper pipeline for Reel Transcriber. That FastAPI service doesn't care whether the audio came from Instagram or your own phone.

**What's new:** an upload endpoint (instead of a URL) that accepts an audio file and runs it through the same faster-whisper model.

**UI:**
- `/voice-notes` — record or upload, get a transcript back, save it like a Journal entry or send it straight to Idea Hub as a new raw idea
- This is probably the single highest-leverage addition here because the hard part (the transcription service) is already done

---

## 📚 7. Reading & Learning Tracker

**Data model:**
```
LearningItem (title, type: article/book/course, url?, status: to-consume/in-progress/done, notes)
```

**UI:**
- Simple Kanban or list, three columns by status
- Notes field doubles as a mini book-notes system — could later feed Key Principles in Script Writer if a book teaches you a content/business lesson worth reusing

---

## 👥 8. Personal CRM

**Data model:**
```
Contact (name, relationship, lastContactDate, nextFollowUpDate?, notes)
```

**UI:**
- `/contacts` — sorted by "needs follow-up" first
- Dashboard widget: "People to reach out to this week"

---

## Also worth a line each (lower priority, same patterns apply)

- **Unified reminder/notification center** — one place aggregating due tasks, subscription renewals, follow-ups, and goal check-ins rather than each module having its own silent deadline
- **Data export & backup** — a single "export everything as JSON/ZIP" button; cheap insurance given this is a self-hosted SQLite app with no managed backups
- **Focus timer** — a simple Pomodoro widget tied to a Task, logging elapsed time against `Task.sortOrder` items you're actively working
- **Weekly digest** — an auto-generated Monday summary (tasks due, subscriptions renewing, review prompts) — once you have an AI layer wired in for Script Writer, this is nearly free to add on top

---

## Suggested build order

1. **Idea Hub** — unlocks the Script Writer persona feature you actually asked about
2. **Voice Memo Transcription** — near-zero marginal cost given the existing transcriber service
3. **Subscriptions Tracker** — small, immediately useful
4. **Personal Finance Snapshot** — moderate effort, high daily value
5. Everything else, as needed
