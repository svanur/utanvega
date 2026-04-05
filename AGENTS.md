# Agent Context: Utanvega

## Project Overview
- **Goal**: A site to find fun and exciting trails for trail running, hiking & cycling to share with friends. Mobile-first PWA targeting Icelandic trail runners with bilingual support (Icelandic default, English available).
- **Tech Stack**:

  | Layer | Technology |
  |-------|-----------|
  | **Frontend** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Recharts 3, react-i18next |
  | **Admin** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Supabase Auth |
  | **Backend** | .NET 9, MediatR (CQRS), EF Core, PostGIS, JWT Auth |
  | **Database** | PostgreSQL + PostGIS (via Supabase) |
  | **Tests** | xUnit, Moq, SQLite in-memory |
  | **Hosting** | Fly.io (backend), Vercel (frontend + admin) |

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
- Translations added to both `en.json` and `is.json` for any new user-facing text.

## Agent Workflow
- After completing each task or logical unit of work, **always** use the `ask_user` tool to ask for next steps.
- Provide 1–3 relevant choices based on what makes sense to do next (e.g., related improvements, fixes spotted during work, items from the backlog).
- Always allow freeform input so the user can type their own answer.
- Keep choices actionable and specific, not vague. Example: "Add elevation profile interactivity" not "Improve frontend".
- Feel free to question the user's choices. Come up with a plan to address their concerns. Use best practices for the task at hand.
- Do not commit and push changes to the repository until the user explicitly approves. Always ask for confirmation before pushing.

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
