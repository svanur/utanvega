# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This repo also has `AGENTS.md` at the root — read it too. It contains detailed backend/frontend/admin coding rules, gotchas, and the three-agent workflow policy (`/go` pipeline; agents cut feature branches from `develop` and open PRs against `develop`, but never write to `develop` or `main` directly, and never merge). This file focuses on commands and architecture; avoid duplicating AGENTS.md.

## Project

Hlaupadagskra.is (repo name `utanvega`) — a bilingual (Icelandic default, English) mobile-first PWA for discovering trail running/hiking/cycling trails in Iceland. Three apps in one repo: a public `frontend`, an `admin` dashboard, and a shared `.NET` `backend`.

## Commands

Run from repo root unless noted.

```bash
npm install                       # root deps
cd frontend && npm install        # frontend deps
cd admin && npm install           # admin deps

npm run dev                       # all three apps concurrently
npm run dev:frontend              # frontend only  → http://localhost:5173
npm run dev:admin                 # admin only     → http://localhost:5174
npm run dev:backend               # backend only (dotnet watch) → http://localhost:5062

cd frontend && npm run build      # tsc -b && vite build
cd frontend && npm run lint       # eslint .
cd admin && npm run build
cd admin && npm run lint

cd backend.Tests && dotnet test                                   # full backend test suite (xUnit, 78+ tests)
cd backend.Tests && dotnet test --filter "FullyQualifiedName~ClassName"  # single test class
cd backend.Tests && dotnet test --filter "FullyQualifiedName~ClassName.MethodName"  # single test

dotnet ef database update --project backend  # apply EF Core migrations
```

Backend uses `dotnet user-secrets` for local config (connection strings, Supabase keys) — never hardcode secrets. Frontend reads `VITE_API_URL` from `.env.development` (fallback `http://localhost:8080`).

**Windows gotcha**: stop the running backend process before `dotnet build`/`dotnet test` — the running EXE locks the output and build fails with MSB3027. (`Stop-Process -Id <PID> -Force`)

CI (`.github/workflows/ci.yml`) runs backend build+test and frontend build on every push/PR to `main`; there's no separate admin CI job.

## Architecture

**Backend** (`backend/`) — .NET 9 minimal APIs (no controllers), all endpoints registered directly in `Program.cs` (~1700 lines) via `app.MapGet/MapPost/...`. CQRS via MediatR:
- `Application/<Feature>/Commands|Queries` — MediatR handlers, one feature folder per domain concept (Trails, Locations, Events, Activities, TrailCheckIns, Analytics, History, Weather, Validation, Caching).
- `Core/Entities`, `Core/Services` — domain entities and services, framework-agnostic.
- `Infrastructure/Persistence` — EF Core `DbContext`, repositories, migrations live in `backend/Migrations`.
- Endpoints call `IMediator.Send(...)`; auth is `[Authorize]` per-endpoint with JWT bearer (Supabase-issued tokens validated via `SUPABASE_JWT_SECRET`); error handling is per-endpoint try/catch → `Results.Problem()/NotFound()/BadRequest()` (no global exception middleware).
- PostGIS is used for spatial data: `GpxData` is `LineStringZ` (3D, elevation-preserving), location centers are `Point` + radius in km, SRID 4326.
- Icelandic slug generation normalizes special characters (þ→th, ð→d, æ→ae, ö, á, é, í, ó, ú, ý).

**backend.Tests/** — xUnit + Moq + SQLite in-memory (`TestDbContextFactory.cs`), organized to mirror source: `Handlers/`, `Services/`, `Validators/`.

**Frontend** (`frontend/`) and **Admin** (`admin/`) — separate Vite apps, same conventions:
- MUI 5 with `sx` prop / theme (`theme.ts`) for styling — no styled-components, no CSS modules, no hardcoded colors (breaks dark mode).
- No global state library; data fetching is done via custom hooks (`hooks/useTrails.ts`, `useLocations.ts`, `useFavorites.ts`, admin's `useAuth.tsx`, etc.) using direct `fetch()` against `API_URL` — there is no centralized API client.
- Functional components only, mobile-first responsive layout.
- Routing/composition lives in `App.tsx`; frontend also wires up i18n in `main.tsx`.
- i18n is **`frontend` only** — the `admin` app is English-only, with no `admin/src/i18n`, no
  `react-i18next` and no translation files; its strings are written inline in English.
- Frontend i18n: `react-i18next`, language persisted to `localStorage('utanvega-lang')`, translations in `frontend/i18n/en.json` / `is.json` — any new user-facing string needs both. Icelandic has gendered adjectives (e.g. "leið" is feminine) — keep this in mind when adding translated strings.
- Leaflet (`react-leaflet`) powers map components (`TrailMap`, `TrailMapView`, `LocationsPage`) — containers need explicit height.
- Admin uses `@supabase/supabase-js` directly for auth (`admin/src/hooks/useAuth.tsx`); no such auth in frontend.

**Solution file**: `utanvega.slnx` wires `backend`, `backend.Tests`, `admin` (`.esproj`), `frontend` (`.esproj`) together for IDE use (Rider/VS).

**Hosting**: backend on Fly.io (`backend/fly.toml`, `backend/Dockerfile`), frontend + admin on Vercel.
