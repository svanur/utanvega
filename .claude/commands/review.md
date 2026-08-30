---
description: Re-enter the pipeline at the review step for an already-open PR, and run the fix loop from there.
argument-hint: "<PR number>"
---

Resume a cycle that was interrupted. The PR in `$ARGUMENTS` already exists — skip the Scrum Master
and the initial implementation entirely, and start at the review step.

Use this when a `/go` cycle was cut short (session restart, config reload, crash) and a PR is sitting
open without a completed review. Do **not** use it to re-review a PR that already reached
`GOOD_TO_MERGE` — that's finished work.

## Step 1 — check the base branch

```
gh pr view <N> --json baseRefName,headRefName,state,title
```

If `baseRefName` is not `develop`, stop and tell the owner before reviewing anything:
`PR #<N> targets <base>, not develop. Fix with: gh pr edit <N> --base develop`
A review against the wrong base reads a diff that isn't the real change.

## Step 2 — count prior rounds

```
gh pr view <N> --comments
```

Count existing `## Review — round R` comments from the Tester. The round you're about to run is
`R+1`, and the 3-round cap counts them all — an interrupted cycle does not reset the budget.

If 3 rounds have already happened, do not start a fourth. Escalate to the owner with what's still
disputed.

## Step 3 — review

Call the `tester` agent (foreground). Pass it **only** the PR number, the linked issue number, and
the round number. Do not pass any prior Programmer reasoning — the cold read is the point.

## Step 4 — the fix loop

Same as `/go`, with one difference: the original `programmer` agent from the interrupted cycle no
longer exists, so there is no warm context to `SendMessage` into. Spawn a fresh `programmer` and
give it the PR number, the linked issue, and the blocking findings. Tell it explicitly that the
branch already exists and is pushed — it must `git checkout <branch>` and add commits, **not** cut a
new branch or open a second PR.

From there, `SendMessage` between the two agents as normal, up to the shared 3-round cap.

## Step 5 — hand back and stop

Report exactly as `/go` does, then **end your turn**. Do not merge, and do not pick up a new issue.
