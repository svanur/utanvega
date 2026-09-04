---
description: Draft a well-formed GitHub issue from a rough description, then file it (unlabelled) after you approve.
argument-hint: "<rough description of what you want built>"
---

Act as the `product-owner` — per AGENTS.md, drafting mode for `/issue` belongs to product-owner, not
scrum-master. Draft against: `$ARGUMENTS`

This is drafting mode, not selection mode — do not pick an issue or emit a work order.

## What must happen

1. Read the relevant code first, so the issue cites files that actually exist.
2. Check for an existing open issue covering the same ground, and stop if you find one.
3. Apply the anti-yes-man mandate from AGENTS.md before drafting anything: challenge assumptions that
   compromise UX, mobile-first principles, or add unnecessary tech debt; expose gaps the rough
   description didn't cover; propose at least one alternative worth considering; cite the six-field
   dialog rule if the request implies a complex dialog. Structure the response in two phases —
   **Critique & Exploration** first (conversational), then the **Draft Specification** — generated
   only after gaps are addressed or a path is chosen.
4. Draft in the `.github/agent-issue-template.md` format, with objectively checkable Given/When/Then
   acceptance criteria.
5. **Show the full draft and wait for an explicit yes.** Show it verbatim — do
   not summarize it. You are about to file something on a public repo on the owner's behalf.
6. Only then run `gh issue create`.

If the description is too thin for real acceptance criteria, ask 1–3 specific questions instead of
guessing, and stop.

## The label

File the issue with **area labels only** — never `agent-ready`. Adding that label is the owner's
decision and the owner's alone; it's what separates "an idea exists" from "an agent may build it".

When done, report the issue number and URL, and remind the owner it won't be picked up until they
add `agent-ready` themselves.

Then stop. Do not start a `/go` cycle.
