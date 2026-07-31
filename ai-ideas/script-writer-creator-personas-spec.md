# Script Writer 2.0 — Creator Persona System

Extends the existing Script Writer (`/scripts`, `/principles`, `/styles`) with a persona layer: stored scripts + lessons *from a specific creator*, so the AI writes new scripts in that individual's voice. Paste a topic (from Idea Hub or a Project), pick a persona, get a draft in that style.

---

## 🎭 Creator Personas (new module)

A **Persona** is a named voice profile: description, a library of reference examples, and a set of lessons/principles about *why* that voice works. Two personas from your message, used throughout as the running example:

- **Kallaway** — fast, punchy, direct-to-camera business/tech shorts
- **Sabri** — direct-response, problem-agitate-solution style copy

These are just labels for voice profiles you fill in with your own observations — the system doesn't need to "know" who they are, it needs *your notes* on what makes their scripts work.

### Data model

```
CreatorPersona
  ├── name                 (e.g. "Kallaway")
  ├── description          (one-line: what this voice is known for)
  ├── colorTag
  └── active

PersonaExample
  ├── personaId
  ├── sourceType           (manual | transcription)
  ├── transcriptionId?     ← optional FK to SavedTranscription
  ├── content              (the reference script/transcript text)
  └── note                 (why you saved this one — what it demonstrates)

PersonaLesson
  ├── personaId
  ├── title                (e.g. "Hook structure", "Pacing", "CTA style")
  └── content              (your written-out rule or observation)
```

### The Reel Transcriber tie-in (this is the good part)

You already transcribe Instagram reels locally. When a saved transcription is *from* a creator you're studying, tag it directly to their persona instead of re-typing it:

- **Links tab pattern reused:** exactly like the existing "Pick from saved transcriptions" flow in Project Links, add a "Pick from saved transcriptions" section on the Persona Examples tab
- Selecting a saved transcription auto-creates a `PersonaExample` with `sourceType: transcription`, `transcriptionId` set, and `content` pulled from the transcription text
- Net effect: your existing transcriber becomes the ingestion pipeline for the persona library, no new scraping/import code needed

### UI

**`/personas`** — grid of persona cards (name, color, description, count of examples + lessons)

**`/personas/[id]`** — three tabs, same pattern as Project Detail:
- **Examples tab** — list of reference scripts, "Add manually" or "Pick from saved transcriptions", inline note per example
- **Lessons tab** — list of style rules, inline add/edit (title + content), same pattern as Key Principles
- **Generated Scripts tab** — every Script that used this persona, for quick reference of what's worked before

---

## ✍️ Updated Script Generation Flow

**`/scripts/new`** gets a new entry path alongside the blank editor:

1. **Pick a topic source** — paste freeform text, or pull from Idea Hub (`/ideas`, promote an Idea directly), or link a Project
2. **Pick a persona** (optional — leave blank for your own natural voice, using the existing Key Principles / Script Styles as before)
3. **Pick a script style** (existing `ScriptStyle` model — structure/template, independent of persona/voice)
4. **Optional constraints** — target length, platform (Reel/Short/long-form), specific CTA
5. **Generate** → draft opens in the existing two-panel editor, fully editable, saved as a normal `Script` with `personaId` and `ideaId` set

### Data model additions to existing models

```
Script
  ├── ...existing fields
  ├── personaId?    ← optional FK to CreatorPersona
  └── ideaId?       ← optional FK to Idea (from Idea Hub, see the feature-ideas doc)
```

### Generation prompt strategy

The system prompt assembled server-side before calling the AI layer:

1. **Persona lessons** — all `PersonaLesson.content` for the selected persona, verbatim (these are *your own* written rules, safe to include in full)
2. **2–3 short example excerpts** — from `PersonaExample`, capped (e.g. ~150 words each) — used strictly as *style reference*, not content to copy
3. **Explicit instruction** — "write an original script inspired by the voice/structure above; do not copy phrases from the examples verbatim; the topic and content are new"
4. **The topic/idea text** and any selected `ScriptStyle` structure
5. **Constraints** (length, platform, CTA) appended last since they're the most likely to change per-generation

Keeping lessons/examples separate matters: lessons are *rules* (always include in full, they're short and high-signal), examples are *flavor* (keep short and rotate which ones you attach, so the model isn't just echoing one saved reel).

---

## Example: same topic, two personas

Illustrative only — showing what the *contrast* should look like once this is wired up, not real output from either creator.

**Topic:** "why most first-time SaaS founders underprice their product"

**Kallaway-style draft** (fast hook, numbered, direct-to-camera):
> Three reasons your SaaS is underpriced — and the third one is costing you the most customers. One: you're pricing off your costs, not the value the customer gets. Two: you never tested a higher number, so you don't actually know your ceiling. Three — the big one — cheap pricing signals cheap product. Fix your price before you fix your funnel.

**Sabri-style draft** (problem–agitate–solution, direct response):
> You built something people actually need — and you're still barely covering your server bill. Every month you underprice, you're not just losing margin, you're training your best customers to expect a discount forever. Here's the fix: raise your price, add one high-value guarantee to kill the risk, and watch which customers stay. The ones who leave were never going to pay you what you're worth anyway.

Two very different structures from one topic — that contrast is the entire point of the persona layer.

---

## Route additions

```
/ideas               → Idea Hub (new — see feature-ideas doc)
/personas            → Persona list
/personas/[id]        → Persona detail (Examples / Lessons / Generated Scripts tabs)
/scripts/new          → Extended with topic-source + persona-pick step
```

## Database model summary (additions only)

```
Idea
  ├── title, rawNotes, tags[], status
  └── linkedProjectId?, linkedScriptId?

CreatorPersona
  ├── name, description, colorTag, active
  ├── PersonaExample[]  (content, note, optional transcriptionId link)
  └── PersonaLesson[]   (title, content)

Script (existing, extended)
  ├── personaId?
  └── ideaId?
```
