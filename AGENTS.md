# Agent Context: Utanvega

## Project Overview
- **Goal**: A site to find fun end exciting trails for trail running, hiking & cycling to share with friends.
- **Tech Stack**:

  | Layer | Technology |
  |-------|-----------|
  | **Frontend** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Recharts 3 |
  | **Admin** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Supabase Auth |
  | **Backend** | .NET 9, MediatR (CQRS), EF Core, PostGIS, JWT Auth |
  | **Database** | PostgreSQL + PostGIS (via Supabase) |
  | **Tests** | xUnit, Moq, SQLite in-memory |
  | **Hosting** | Fly.io (backend), Vercel (frontend) |

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

## Backend Rules (C# / .NET)
- **Style**: Use file-scoped namespaces and C# 12+ features.
- **Patterns**: Use Dependency Injection; use CQRS architecture via MediatR.
- **Async**: Always use `Task` and `await`. Avoid `.Result` or `.Wait()`.
- **Error Handling**: Use global exception handling middleware; return `ProblemDetails`.

## Database & Data (EF Core)
- **Naming**: Use PascalCase for entity properties.
- **Migrations**: Always review `Up()` and `Down()` methods before applying.
- **Queries**: Use `AsNoTracking()` for read-only operations to boost performance.

## Frontend Rules ([Frontend Tech])
- **Style**: [fill out].
- **API Calls**: All calls should go through a centralized `apiClient` or service layer.
- **State**: [fill out].

## Definition of Done
- Code builds without warnings.
- New logic includes basic unit tests in the `.Tests` project.
- Sensitive strings are handled via `IConfiguration` or User Secrets.
