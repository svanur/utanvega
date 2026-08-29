---
description: Draft a well-formed GitHub issue from a rough description, then file it (unlabelled) after you approve.
argument-hint: "<rough description of what you want built>"
---

Put the `scrum-master` agent into **drafting mode** and hand it: `$ARGUMENTS`

Call it foreground (`run_in_background: false`). Tell it explicitly that this is drafting mode, not
selection mode — it must not pick an issue or emit a work order.

## What must happen

1. It reads the relevant code first, so the issue cites files that actually exist.
2. It checks for an existing open issue covering the same ground, and stops if it finds one.
3. It drafts in the `.github/agent-issue-template.md` format, with objectively checkable acceptance
   criteria.
4. **It shows you the full draft and waits for your explicit yes.** Relay the draft verbatim — do
   not summarize it. You are about to file something on a public repo on the owner's behalf.
5. Only then does it run `gh issue create`.

If the description is too thin for real acceptance criteria, it asks you 1–3 specific questions
instead of guessing. Relay those and stop.

## The label

It files the issue with **area labels only** — never `agent-ready`. Adding that label is the owner's
decision and the owner's alone; it's what separates "an idea exists" from "an agent may build it".

When done, report the issue number and URL, and remind the owner it won't be picked up until they
add `agent-ready` themselves.

Then stop. Do not start a `/go` cycle.
