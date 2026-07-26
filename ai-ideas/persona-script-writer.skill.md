---
name: persona-script-writer
description: Use this skill when generating a short-form video script that should match a specific creator's voice, given a topic, that creator's stored lessons/principles, and 1-3 reference example scripts. Triggers whenever a request includes a persona/creator name, a topic, and either example scripts or style notes to write from. Do not use for generic script writing with no persona attached — use plain Key Principles / Script Style generation instead.
---

# Persona Script Writer

Generates an **original** short-form script in a specific creator's voice, using the creator's stored lessons and a small number of reference examples as style guidance — never as content to copy.

## Required inputs

Before generating, confirm you have:

1. **Topic** — the raw idea or subject the script should cover
2. **Persona lessons** — the user's own written notes on what defines this creator's voice (hook style, pacing, structure, vocabulary, CTA pattern). Include these in full; they're short, high-signal, and explicitly authored by the user.
3. **Persona examples** — 1-3 short reference scripts (cap each at ~150 words). These exist to show *rhythm and structure*, not to be paraphrased line-by-line.
4. **Script style / structure** (optional) — an independent structural template (e.g. hook → 3 points → CTA) that applies regardless of persona.
5. **Constraints** (optional) — target length, platform, specific CTA.

If lessons and examples are both missing, stop and ask for at least one — a persona with zero reference material can't be distinguished from a generic voice.

## Generation rules

- **Structure and rhythm over vocabulary.** Match sentence length, pacing, hook placement, and structural beats from the examples. Do not lift specific phrases, jokes, or turns of phrase from the reference material.
- **The topic is new content.** Every claim, example, and detail in the output must be about the *current* topic — never carried over from the reference examples' subject matter.
- **One clear hook in the first line.** Whatever the persona's hook style is (question, bold claim, numbered promise, pattern interrupt), open with it.
- **Respect the lessons as hard constraints, examples as soft guidance.** If a lesson says "always ends with a direct question to camera" and an example happens not to, follow the lesson.
- **Length discipline.** If a constraint specifies length (e.g. "30-second short"), write to that pacing — don't pad.
- **Flag uncertainty.** If the lessons and examples seem to contradict each other, note the conflict rather than silently picking one.

## Output format

```
[Persona name] — [Topic]

<script text, ready to drop into the editor>

---
Notes: (any structural choices worth flagging, e.g. "used the numbered-list
hook since two of the three examples opened that way")
```

## What this skill does NOT do

- Does not fetch or research the creator's real public content — it only uses what's explicitly provided as lessons/examples
- Does not attribute the output to the real creator anywhere in the text (no "as Kallaway would say") — the output is the user's own script, styled after a voice they've studied
- Does not reproduce any reference example verbatim, even partially, beyond a few incidental common words
