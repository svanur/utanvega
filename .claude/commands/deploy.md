---
description: Prepare a release — bump versions, write the changelog-diary entry in both locales, and open the develop→main PR. Never merges.
argument-hint: "[optional version number, e.g. 1.18.0 — defaults to an auto-bumped patch]"
---

You are preparing a release. This is an **ad-hoc interactive session** action, not a pipeline cycle
— `AGENTS.md`'s "no direct write to develop/main" rule is pipeline-agent-only; here the rule is
"ask before pushing" (`AGENTS.md:240`), which Step 5 below satisfies. **Merging stays human-only,
always, no exception** (`AGENTS.md:233`) — this command never merges anything.

## Step 0 — pre-flight

Run `git status`. If the working tree isn't clean, stop and tell the owner — do not stash or
discard anything yourself. Confirm the current branch is `develop` (`git branch --show-current`);
if not, stop and ask whether to switch.

## Step 1 — determine the version

Read the current version from `frontend/package.json`. If `$ARGUMENTS` contains a version number,
use it (validate it's a plausible semver, greater than current). Otherwise auto-bump the patch
number (`x.y.z` → `x.y.(z+1)`).

`admin/package.json` always gets the same version string — these two packages are versioned in
lockstep (confirmed: every prior bump commit touches both files together, same version).

## Step 2 — gather what shipped

Find the last version-bump commit (`git log --oneline --grep="bump version to"` or similar — recent
convention is `chore: bump version to X.Y.Z`). List merged PRs/commits on `develop` since then
(`git log <last-bump>..HEAD --oneline`) to use as source material for the changelog entry — read
enough of each to summarize user-facing impact, not implementation detail (match the tone of
existing `about.changelog` entries: concise, reader-facing, e.g. "Event pages now show historical
climate normals...", not "Added GetEventClimateQuery handler").

## Step 3 — draft the changelog entry (four places, must all agree)

The version key is the dotted version with underscores, `v`-prefixed — e.g. `1.18.0` → `v1_18_0`.

1. **`frontend/i18n/en.json`** and **`frontend/i18n/is.json`** — add
   `about.changelog.v{key}: { "title": "...", "description": "..." }` to both files, each written
   natively in its own language (not a literal translation of the other) — same as every existing
   entry.
2. **`frontend/pages/ChangelogDiaryPage.tsx`**:
   - Prepend the new key to the `VERSIONS` array (`:42-47`) — newest first.
   - Add an entry to `RELEASE_DATES` (`:54-84`) — today's date, `YYYY-MM-DD`.
   - Add the key to the `GITHUB_RELEASES` set (`:91`) — every 1.0.0+ release gets one; only skip
     this if the owner says no GitHub Release will be cut for this version.
   - Add an entry to `TAGS` (`:100-...`) — an array drawn from the existing tag vocabulary only
     (`admin`, `frontend`, `events`, `editions`, `races`, `trails`, `historyPage`,
     `photographers` — check `about.changelogDiary.tags` in `en.json` for the current full list).
     If a genuinely new tag is needed, that's a bigger change (new i18n keys in both locales plus
     this map) — flag it to the owner rather than inventing one silently.

## Step 4 — bump the version files

Set `"version"` in both `frontend/package.json` and `admin/package.json` to the new version string.

## Step 5 — show the full diff and get explicit approval

Before touching git, show every changed file's diff together (both `package.json`s, both i18n
files' new entries, the four `ChangelogDiaryPage.tsx` edits) as one reviewable block. Wait for the
owner's explicit yes. This is the "ask before pushing" gate — do not proceed on an assumed yes.

## Step 6 — commit and push to develop

One commit, message `chore: bump version to X.Y.Z` (matching the current convention). Push to
`develop`.

## Step 7 — open the develop→main PR

```
gh pr create --base main --head develop --title "Release vX.Y.Z" --body "<the changelog entry's title/description, plus a link to the full PR list since the last release>"
```

## Step 8 — hand back and stop

Report the PR URL. Tell the owner explicitly:
- This command does not merge — they review and merge `main` themselves.
- This command does not yet create the GitHub Release/tag after merge — that's a separate manual
  step for now (`gh release create vX.Y.Z --target main ...`), not automated here. Don't imply it
  already happened.

Then end your turn. Do not start another cycle, do not pick up an issue.
