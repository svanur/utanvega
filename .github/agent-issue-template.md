# Agent issue template

Copy the block below into a new GitHub issue and fill it in. Then add the **`agent-ready`**
label when it's ready to be picked up — that label is the queue.

Kept here rather than in `.github/ISSUE_TEMPLATE/` on purpose: putting it there would make GitHub
offer it as a second choice alongside the `Agent task` form and prompt you to pick every time.

```markdown
**Area:** frontend | admin | backend | database | mixed
**Blocked by:** #

## Problem


## Proposed change


## Acceptance criteria

- [ ] 
- [ ] 

## Out of scope

- 

## Mobile


## Security


## Starting points

- 
```

## The two lines that matter

**Acceptance criteria** — the Scrum Master refuses an issue whose criteria aren't objectively
checkable, and the Tester reviews the PR against them. Everything else is optional context; this
one isn't.

**Blocked by** — delete the line if nothing blocks it. This is what overrides the normal
lowest-number-first order, letting a higher-numbered issue be worked first. GitHub doesn't enforce
the relation and `gh` doesn't expose its native one, so this line is the source of truth.

## Leaving sections blank

**Mobile** and **Security** can be empty when nothing special applies. The Tester runs its standard
checks either way — 375px layout, 44px touch targets, TrailCard gestures, dark mode, both i18n
files, `[Authorize]` on new endpoints, ownership checks, secrets. Use those sections only for things
specific to *this* issue that it wouldn't otherwise know to look for.

See `AGENTS.md` → **Agent Workflow** for how the issue then moves through the pipeline.
