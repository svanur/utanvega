# Agent Context: Utanvega

## Project Overview
- **Goal**: A site to find fun and exciting trails for trail running, hiking & cycling to share with friends. Mobile-first PWA targeting Icelandic trail runners with bilingual support (Icelandic default, English available).
- **Tech Stack**:

  | Layer        | Technology                                                              |
  |--------------|-------------------------------------------------------------------------|
  | **Frontend** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Recharts 3, react-i18next |
  | **Admin**    | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Supabase Auth             |
  | **Backend**  | .NET 9, MediatR (CQRS), EF Core, PostGIS, JWT Auth                      |
  | **Database** | PostgreSQL + PostGIS (via Supabase)                                     |
  | **Tests**    | xUnit, Moq, SQLite in-memory                                            |
  | **Hosting**  | Fly.io (backend), Vercel (frontend + admin)                             |

## Development Setup
- **Secrets**: Uses `dotnet user-secrets`. Do not hardcode keys.
- **Commands**:
- npm run dev # From the repo root

This starts all three projects concurrently:
- **Frontend** → http://localhost:5173
- **Admin** → http://localhost:5174
- **Backend** → http://localhost:5062

Or run individually:

- npm run dev:frontend   # Frontend only
- npm run dev:admin      # Admin only
- npm run dev:backend    # Backend only (dotnet watch)

**Testing**:
- dotnet test backend.Tests/  # 78+ xUnit tests

**Environment**:
- Frontend uses `VITE_API_URL` (from `.env.development`, fallback `http://localhost:8080`)
- Backend uses `dotnet user-secrets` for Supabase keys, connection strings, etc.

## Backend Rules (C# / .NET)
- **Style**: Use file-scoped namespaces and C# 12+ features.
- **Patterns**: Use Dependency Injection; use CQRS architecture via MediatR.
- **Async**: Always use `Task` and `await`. Avoid `.Result` or `.Wait()`.
- **Error Handling**: Per-endpoint try-catch blocks returning `Results.Problem()`, `Results.NotFound()`, or `Results.BadRequest()`. No global exception middleware currently.

## Database & Data (EF Core)
- **Naming**: Use PascalCase for entity properties.
- **Migrations**: Always review `Up()` and `Down()` methods before applying.
- **Queries**: Use `AsNoTracking()` for read-only operations to boost performance.

## Frontend Rules (React / TypeScript / MUI)
- **Style**: MUI 5 components with `sx` prop (Emotion CSS-in-JS). No styled-components or CSS modules. Use the MUI theme for colors, spacing, and breakpoints.
- **API Calls**: Direct `fetch()` using `API_URL` exported from `hooks/useTrails.ts` (`import.meta.env.VITE_API_URL`). No centralized API client — hooks manage their own data fetching.
- **State**: Custom React hooks (`useState` + `useEffect`) — no Redux/Zustand. Key hooks: `useTrails`, `useLocations`, `useFavorites`, `useHiddenTrails`. Theme mode (light/dark) managed via `useState` in `App.tsx`.
- **i18n**: Icelandic (`is`) default, English (`en`) fallback. Uses `react-i18next`. Language persisted in `localStorage('utanvega-lang')`. Translation files: `frontend/i18n/en.json` and `is.json`.
- **Components**: Functional components only. Mobile-first responsive design using MUI breakpoints. Touch gestures (swipe, long-press) for mobile UX.

### Dialogs vs pages

Use a **dialog** for a single confirmation, or a short form of roughly **six fields or fewer**.

Use a **page or an inline form** for anything longer. A long form in a modal means scrolling inside a
popup, which is a poor container on desktop and a bad one on a phone — and a page can be linked to,
which a dialog cannot.

Two hard rules:

- **Never open a dialog from a dialog.** If a flow seems to need it, the outer dialog should have been
  a page.
- **An action with consequences beyond the field it names is not a field edit.** Cancelling an event
  cascades to its editions and races, so it does not belong in a Status dropdown. Give it a dedicated
  control and confirm it — click-to-arm with a tooltip naming the effect for narrow-scope actions
  (see Cancel/Delete edition), a dialog when the blast radius is wide enough to need itemising.

Existing code does not fully follow this. `LocationDialog` (12 fields) is a known exception awaiting
conversion; smaller dialogs like `CreateEventDialog` (4 fields) are correct as they are.
**Follow this rule for new work rather than matching the nearest existing dialog** — the convention is
the target, not the current average.

**Check that a component is actually rendered before working on it.** `TrailEditDialog` was an
18-field dialog that nothing imported; two issues cited it by path and three commits were spent
fixing it before anyone noticed the live code was elsewhere (see #541). A component can be complete,
correct and entirely dead. When an issue names a file, confirm it is reachable from a route first.

## Project Structure
```
frontend/
├── components/    # Reusable UI components (TrailCard, TrailMap, Layout, etc.)
├── hooks/         # Custom data hooks (useTrails, useFavorites, useLocations, etc.)
├── pages/         # Route pages (HomePage, TrailDetailsPage, LocationsPage, etc.)
├── i18n/          # Translation config + en.json / is.json
├── App.tsx        # Router + theme setup
├── main.tsx       # Entry point (imports i18n)
└── theme.ts       # MUI theme configuration

admin/src/
├── components/    # Admin UI components
├── hooks/         # Admin data hooks (useTrails, useLocations, useAuth, etc.)
├── pages/         # Admin pages (TrailList, LocationList, etc.)
└── App.tsx        # Admin shell with collapsible sidebar

backend/
├── Application/   # CQRS handlers (Commands + Queries via MediatR)
├── Core/          # Entities, interfaces, services
├── Infrastructure/# EF Core context, migrations, repositories
└── Program.cs     # Minimal API endpoints
```

## Definition of Done
- Code builds without warnings.
- New logic includes basic unit tests in the `.Tests` project.
- Sensitive strings are handled via `IConfiguration` or User Secrets.
- Translations added to both `en.json` and `is.json` for any new user-facing text — **`frontend`
  only**. The `admin` app is English-only: there is no `admin/src/i18n`, no `react-i18next`, and
  no translation files. Admin strings are written inline in English. Do not add an i18n layer to
  `admin` to satisfy this rule; it does not apply there.

## Agent Workflow

Work moves through a three-agent pipeline defined in `.claude/agents/`. One issue per cycle.

```
[ Human-Driven Innovation ]
/issue <your intent>  ─┐
                       ▼
                 product-owner  ⇄  human debate  →  human approves  →  [Backlog]
                       ▲
/pitch ────────────────┘
[ AI-Driven Innovation ]

[ Delivery / Execution Pipeline ]
/go  →  scrum-master  →  programmer  →  tester  ⇄  programmer  →  owner merges
     (picks 1 issue)   (branch, code,   (cold review:   (max 3 rounds)
                        tests, PR)       security +
                                         mobile first)
```

#### 🧠 Strategic Persona & Anti-"Yes-Man" Behavior
The product-owner is a peer-level product strategist, not a passive dictation tool. It must actively protect the product's long-term health, user experience, and architecture by enforcing the following behaviors during the `/issue` drafting phase:

- **Challenge Assumptions:** If a human request compromises user experience, violates mobile-first PWA principles, or introduces unnecessary technical debt, the agent must politely but firmly push back with a reasoned objection.
- **Expose Product Gaps:** Every rough description contains missing edge cases. The agent must systematically search for gaps (e.g., "What happens if a trail runner loses cellular connection on an Icelandic mountain?", "How does this layout adapt to one-handed thumb navigation?").
- **Propose "Fresher" Alternatives:** For every feature request, the agent should present at least one alternative or expansion that the human might not have considered (e.g., leveraging specific mobile touch gestures or smart i18n localization patterns).
- **Enforce Strict UI Rules:** If a human requests a complex workflow inside a dialog, the agent must proactively cite the **6-field rule** and push to turn it into an inline page form instead.
- **Response Format Requirement:** The agent must structure its response into two distinct phases:
  1. **The Critique & Exploration:** A conversational evaluation of the idea, listing hidden gaps, architectural friction, and alternative solutions.
  2. **The Draft Specification:** The resulting actionable issue template, generated *only* after addressing the gaps or offering a choice of implementation paths.

#### 💡 Proactive Product Innovation (The `/pitch` Loop)
The product-owner agent is expected to be an autonomous driver of product value. When invoked via the `/pitch` command, it must analyze the current codebase, schema designs, and open issues to generate high-value feature enhancements or technical refactors. It should focus its pitches on three core pillars:

1. **UX & Mobile-First Delighters:** Proposing smart touch-gesture interactions, offline capabilities, or micro-interactions specific to trail runners in low-connectivity Icelandic environments.
2. **Feature Extensions:** Finding logical next-steps for existing data structures (e.g., if PostGIS coordinates exist for trails, proposing a "find nearby trails from my current location" API endpoint and UI button).
3. **Dead Code & Debt Cleanup:** Cross-referencing components against active routes (recalling the #541 rule where an 18-field dead dialog was maintained by mistake) and proposing deprecations or cleanups.

Every pitch must include a **Business Justification (Why)**, a **User Impact Assessment (Who benefits)**, and a **High-Level Implementation Strategy (How)** before drafting the technical issue.

- **scrum-master** — read-only while selecting. Picks the lowest-numbered open issue labelled
  `agent-ready` whose blockers are all closed, refuses vague ones, emits a work order. At the end of a
  cycle it also files the PR's durable "spotted but not fixed" leftovers as **unlabelled** issues, so
  they are tracked rather than left in a PR body.
- **programmer** — implements the work order, runs the checks, commits, pushes a feature branch, opens the PR, and applies review fixes.
- **tester** — reviews the PR **cold** (PR number only, never the Programmer's reasoning), posts the review as a PR comment. Cannot edit code. Its tools (`Read, Glob, Grep, Bash`) do not currently
  include a headless-browser or screenshot tool, so 375px layout, dark mode, and touch-target
  findings are, by default, a static reading of theme tokens/`sx` breakpoints rather than a rendered
  check — the review must say which method was used, not imply a render happened.

### Creating issues

`/issue <rough description>` puts the Scrum Master into drafting mode: it reads the relevant code,
checks for duplicates, drafts in the `.github/agent-issue-template.md` format, shows you the draft,
and files it only after you approve.

It files with **area labels only**. It never applies `agent-ready`, and it never creates an issue
during a `/go` cycle — an agent that can both write and pick the backlog can manufacture its own
work, and then the pipeline is running on the agent's intent rather than yours.

### Issue ordering

Add the **`agent-ready`** label to an issue when it's ready to be picked up. Among labelled issues
the Scrum Master takes the **lowest number first**.

To override that order, record dependencies in the issue body:

```
Blocked by: #445, #447
```

The Scrum Master checks each referenced issue and skips the candidate while any blocker is still
open — so a higher-numbered issue can legitimately be worked first. GitHub doesn't enforce this
relation and `gh` doesn't expose its native one, so the body line is the source of truth.

### The human gate

`/go` is the only thing that starts a cycle. Agents never chain into the next issue on their own —
the conductor reports and stops. If the Programmer and Tester disagree for 3 rounds, the cycle
escalates to the owner rather than continuing.

### Git authority

Inside the pipeline, agents are pre-authorized to commit and push to a **feature branch** and open a
PR against `develop`. No per-push confirmation is needed — the `/go` gate and the PR review are the
approval points.

**Verify the branch immediately before every commit**, not once per cycle. A checkout several
commands ago is not evidence of where HEAD is now — another session or cycle can move it in between.
And `git push origin <branch>` pushes the ref of that name, not HEAD, so a commit made on the wrong
branch is followed by a push that reports success while sending nothing. Confirm what landed with
`git merge-base --is-ancestor HEAD origin/<branch>`.

These remain human-only, always:
- **Merging any PR.** Agents never merge and never approve.
- **Any direct write to `develop` or `main`** — no commits, no pushes, no force-pushes. Feature
  branches cut from `develop` and PR back into `develop`; `main` is release-only.
- Force-pushing any branch, `git reset --hard`, or `git clean -fd` on work the agent did not create.
- Changes to CI workflows, `fly.toml`, `Dockerfile`, deploy config, or secrets — unless the issue
  explicitly asks for them.

Outside the pipeline (an ad-hoc interactive session), ask before pushing.

### General conduct

- Stay inside the stated scope. Something broken but out of scope goes in the PR body under
  "Spotted but not fixed" — don't fix it, don't silently expand the PR.
- Question the plan when it looks wrong. A reasoned objection beats a compliant bad change.
- Report checks honestly. If a build failed or a step was skipped, say so — never report a green
  cycle you didn't actually get.

## Gotchas & Tips

### Backend
- **EXE lock**: The backend process must be stopped before running `dotnet build` or `dotnet test` (MSB3027 error). Use `Stop-Process -Id <PID> -Force`.
- **PostGIS**: Spatial queries use SRID 4326 (WGS84). The `GpxData` column stores `LineStringZ` geometry. Location centers use `Point` geometry with radius in km.
- **Icelandic characters**: Slug generation must handle Icelandic letters (þ, ð, æ, ö, á, é, í, ó, ú, ý). These should be normalized (e.g., þ→th, ð→d, æ→ae).
- **Minimal API**: All endpoints are defined in `Program.cs` using .NET minimal APIs, not controllers.

### Frontend
- **Mobile-first gestures**: TrailCard supports swipe-right (favorite), swipe-left (hide), and long-press (quick view). Swipe threshold is 100px. Always test touch interactions.
- **MUI theme**: Dark/light mode toggle exists. Use `theme.palette` colors, not hardcoded colors, to support both modes.
- **Filter state**: `useTrails` hook manages all filtering client-side. Treat slider max values at their cap as "no limit" (e.g., `maxLength < 100` means filtered).
- **Leaflet maps**: Multiple components use Leaflet (TrailMap, TrailMapView, LocationsPage). Maps need explicit height via `sx` or container. Use `react-leaflet` components.
- **Translation pattern**: Use `const { t } = useTranslation()` in components. For functions defined outside components, pass `t` as a parameter. Icelandic has gendered adjectives — "leið" (route) is feminine.

### Admin
- **Supabase Auth**: Admin uses `@supabase/supabase-js` for authentication. Auth context is in `admin/src/hooks/useAuth.tsx`.
- **Collapsible sidebar**: Drawer width toggles between 220px (open) and 56px (collapsed). Uses permanent variant with CSS transitions.
- **Bulk operations**: Tools panel is collapsible. When items are selected and panel is closed, an inline selection bar appears.
