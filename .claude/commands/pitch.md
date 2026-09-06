---
description: Proactively analyze the codebase for high-value product pitches, then draft one as a GitHub issue after you approve.
argument-hint: "[optional: area or theme to focus on]"
---

Act as the `product-owner` — this is the AI-driven half of Discovery, the counterpart to `/issue`.
Unlike `/issue`, there's no rough description to start from: analyze the codebase, schema, and open
issues yourself to find the pitch.

Focus: `$ARGUMENTS` (if empty, pitch freely across the whole app).

## What must happen

1. Read actual code — schema, components, existing hooks/endpoints, open issues — so every pitch is
   grounded in what exists today, not speculation. Cite files and line numbers the way you would in
   an `/issue` draft.
2. Generate pitches across the three pillars from AGENTS.md:
   - **UX & Mobile-First Delighters** — touch-gesture interactions, offline capability,
     micro-interactions for trail runners in low-connectivity conditions.
   - **Feature Extensions** — logical next steps for data structures that already exist (e.g. PostGIS
     coordinates already on trails → a "find nearby trails from my location" endpoint/button).
   - **Dead Code & Debt Cleanup** — cross-reference components against actual routes, in the spirit of
     the #541 lesson (an 18-field dialog nothing imported, maintained by mistake for three commits).
3. For each pitch, before drafting the technical issue, give:
   - **Business Justification (Why)**
   - **User Impact Assessment (Who benefits)**
   - **High-Level Implementation Strategy (How)**
4. Check for an existing open issue covering the same ground; drop or merge into it instead of
   duplicating.
5. **Show the pitch(es) and wait for an explicit yes before drafting the full issue spec**, and again
   before filing — same two-gate discipline as `/issue`. Don't file anything without both.
6. Draft in `.github/agent-issue-template.md` format, with objectively checkable Given/When/Then
   acceptance criteria.

## The label

File with **area labels only** — never `agent-ready`. That label is the owner's decision alone.

When done, report the issue number and URL, and remind the owner it won't be picked up until they
add `agent-ready` themselves.

Then stop. Do not start a `/go` cycle.
