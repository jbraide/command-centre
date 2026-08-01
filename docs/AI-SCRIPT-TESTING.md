# AI Script Generation — Testing Status

> Current state of the AI script writer training + generation pipeline, what works, what was tested, and what still needs work.

---

## ✅ What Works (Tested)

### Training Data Pipeline
| Piece | Status | Details |
|-------|--------|---------|
| **Creator Personas** | ✅ Working | Kallaway Marketing persona configured with lessons + examples |
| **Lesson Extraction** | ✅ Working | "Extract Lessons" from transcriptions → AI analyzes → saves to persona |
| **Persona Examples** | ✅ Working | Manual + transcription-sourced examples stored per persona |
| **Memory Bank** | ✅ Working | Key-value business context (LuxeRide data saved as `business` memories) |
| **Script Styles** | ✅ Working | LuxeRide Nigeria style with full brand/product/voice guidelines |

### Script Generation
| Piece | Status | Details |
|-------|--------|---------|
| **Direct generation** | ✅ Working | `POST /api/ai/generate` combines persona + style → DeepSeek → saves script |
| **Markdown tables** | ✅ Working | Scripts output in `Time | Visual | Voiceover | On-Screen Text | Audio Cues` format |
| **Structured format** | ✅ Working | `format: "structured"` outputs Script + Creative Direction + Production Notes sections, no tables |
| **Structured fields** | ✅ Working | `scriptText`, `creativeDirection`, `productionNotes` stored as separate DB columns |
| **Format selector** | ✅ Working | Output Format toggle (Table / Structured) in generation panel |
| **Preview rendering** | ✅ Working | Edit/Preview toggle renders tables AND structured sections |
| **Batch generation** | ✅ Working | 19 scripts generated across Single Layer, Double Layer, Seat Covers, Bundles |

### Data Imported (via API)
- **Kallaway Marketing persona**: 4 lessons, 5 examples, 1 script
- **LuxeRide Nigeria style**: brand overview, product matrix, audience psychology, USPs, tone/voice, script structure, objection handling, AI rules
- **8 business memories** with LuxeRide context

### Structured Script Example (verified via curl)

A successful `POST /api/ai/generate` with `format: "structured"` returns the three fields separately:

```json
{
  "scriptText": "[00:00-00:05] OPEN on a Lexus LX parked in a Lagos driveway.\n[00:05-00:15] VISUAL: Owner hands over the keys, shows the Double Layer TPE mats.\n[00:15-00:30] VOICEOVER: Keep that luxury interior spotless...",
  "creativeDirection": "Cinematic close-ups of the mats' stitching, warm golden-hour lighting, aspirational but grounded in local driving reality.",
  "productionNotes": "30-second cut. Use a Nigerian voiceover artist. Record wildtrack of car door closing for the transition at 00:15."
}
```

---

## 🧪 Test Results (Night of July 29–30)

### Generation Quality
Generated 12 new scripts (3 per product) using:
- **Persona**: Kallaway Marketing (voice lessons + examples)
- **Style**: LuxeRide Nigeria (business context)

**Observed:**
- ✅ Content is relevant — AI understands product, pricing, audience, and Nigerian context
- ✅ Correct voice — conversational, practical, uses Nigerian idioms where appropriate
- ✅ Table format — proper `Time | Visual | Voiceover | Text | Audio` structure
- ⚠️ Occasional deviations from constraints (price anchoring, format drift)

---

## ❌ What Still Needs Work

### 1. AI Agent Tool Calling (Broken)
**Symptom:** `POST /api/ai/chat` responds with text but **does not call tools** (e.g., `get_personas`, `generate_script`). The model hallucinates data instead of fetching real data.

**Root cause (diagnosed):**
- DeepSeek V4 Flash with `thinking: {type: "enabled"}` does **not** reliably emit native OpenAI-format `tool_calls`
- Sometimes emits tool calls as text (`<tool_call>` / `<invoke>` XML blocks) instead of structured JSON
- The XML fallback parser was implemented but **not fully working** — the model kept producing text-only responses

**Status:** 🔴 In progress — needs the XML invoke parser (from the ceothefirst reference implementation) wired in and tested end-to-end.

### 2. Script Output Format Drift
- Some generations produce prose instead of the requested table format
- Some ignore "never anchor exact prices" rule
- **Fix idea:** more explicit output-format instructions in the system prompt + validation pass after generation

### 3. Training Refinement
- No review/edit UI for extracted lessons before they influence future scripts
- Memory tools exist but aren't wired into the generation pipeline
- No feedback loop (rate generated scripts good/bad to reinforce)

---

## How to Test Today

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:5522/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"braidej@gmail.com","password":"Password12345_"}' | jq -r .token)

# 2. Generate a script (direct pipeline — works)
PERSONA_ID="cms3qu16l0002t03c2gwfcrh0"
STYLE_ID="cms6ljcfq000hk207d5sup73l"

curl -X POST http://localhost:5522/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "topic": "LuxeRide Double Layer TPE for luxury SUV owners",
    "personaId": "'$PERSONA_ID'",
    "scriptStyle": "'$STYLE_ID'",
    "constraints": "Table format. 30 seconds. Target: Lexus, Mercedes owners.",
    "title": "Double Layer - Test"
  }'
```

---

## API Auth (JWT)
- `POST /api/auth/login` → returns `{ token }` (7-day JWT)
- Use `Authorization: Bearer <token>` on all API routes
- Browser sessions use Auth.js cookies (unchanged)
- The `auth()` helper checks both cookies AND Bearer tokens
