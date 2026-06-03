# 🏔️ Hlaupadagskra.is — Trail Discovery for Iceland

A web application for finding races and trails and sharing trails in Iceland. Browse trails on a map, filter by activity type, difficulty, location, and tags — or explore elevation profiles with interactive charts, route playback, and more ...much more.

## Solution Structure

```
utanvega/
├── frontend/        # Public-facing trail browser (React + Vite + MUI)
├── admin/           # Admin dashboard for trail management (React + Vite + MUI)
├── backend/         # API server (.NET 9, CQRS, PostGIS)
├── backend.Tests/   # Unit & integration tests (xUnit)
└── package.json     # Root dev scripts (concurrently)
```

## Tech Stack

| Layer        | Technology                                                  |
|--------------|-------------------------------------------------------------|
| **Frontend** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Recharts 3    |
| **Admin**    | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Supabase Auth |
| **Backend**  | .NET 9, MediatR (CQRS), EF Core, PostGIS, JWT Auth          |
| **Database** | PostgreSQL + PostGIS (via Supabase)                         |
| **Tests**    | xUnit, Moq, SQLite in-memory                                |
| **Hosting**  | Fly.io (backend), Vercel (frontend)                         |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [.NET 9 SDK](https://dotnet.microsoft.com/)
- PostgreSQL with PostGIS (or a Supabase project)
- Docker Desktop (for the local Supabase stack)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/svanur/utanvega.git
cd utanvega
npm install
cd frontend && npm install && cd ..
cd admin && npm install && cd ..
```

### 2. Configure the backend

The backend uses [.NET User Secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets) for local configuration:

```bash
cd backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=..."
dotnet user-secrets set "SUPABASE_JWT_SECRET" "your-supabase-jwt-secret"
```

### 3. Start local Supabase

If the hosted Supabase project is quota-limited or unavailable, use the local stack:

```bash
npm run supabase:setup
```

This generates local env files, starts Postgres + Auth + Kong in Docker, and seeds a local admin login. The generated credentials are printed by the setup script.

### 4. Run database migrations

```bash
cd backend
dotnet ef database update
```

### 5. Start all projects

From the repo root:

```bash
npm run dev
```

This starts all three projects concurrently:
- **Frontend** → http://localhost:5173
- **Admin** → http://localhost:5174
- **Backend** → http://localhost:5062

Or run individually:

```bash
npm run dev:frontend   # Frontend only
npm run dev:admin      # Admin only
npm run dev:backend    # Backend only (dotnet watch)
```

### 5. Run tests

```bash
cd backend.Tests
dotnet test
```

## Local Supabase (Docker) How-To

Use this when hosted Supabase is unavailable (for example quota limits).

### First-time setup

```bash
npm run supabase:setup
```

What this does:
- Generates local env files:
  - `supabase/.env.local`
  - `frontend/.env.local`
  - `admin/.env.local`
- Starts local Supabase services (Postgres + Auth + Kong)
- Seeds a local admin user for login
- Writes backend user-secrets (`ConnectionStrings:DefaultConnection`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`)

### Daily workflow

Start local Supabase:

```bash
npm run supabase:up
```

Stop local Supabase:

```bash
npm run supabase:down
```

Start the app stack:

```bash
npm run dev
```

### Reseed local auth/admin user

```bash
npm run supabase:seed
```

### Useful local endpoints

- Supabase gateway: `http://localhost:8000`
- Auth health: `http://localhost:8000/auth/v1/health`
- Auth service (direct): `http://localhost:9999`
- Postgres: `localhost:5432`

### Local admin login

`npm run supabase:setup` prints the generated local admin credentials in the terminal.

### Reset everything (clean local Supabase state)

```bash
docker compose --env-file supabase/.env.local -f supabase/docker-compose.local.yml down -v
npm run supabase:setup
```

### Notes

- `*.env.local` files are ignored by git.
- Keep production/staging Supabase envs separate from local values.
- If auth fails after env changes, run `npm run supabase:down` then `npm run supabase:setup`.

## Features

### Frontend (Public)
- 📱 Mobile-first trail list with swipe gestures (left to hide, right to favorite)
- 🗺️ Interactive map with trail pins (activity-type emoji icons)
- 📊 Elevation chart with map marker sync
- ▶️ Route playback animation with live stats (distance, elevation, gain/loss)
- 🏷️ Tag-based filtering with shareable URLs (`/tags/:slug`)
- 🔍 Search, filter by activity type, trail type, location, difficulty
- ⭐ Favorites (local storage)
- 🌗 Dark mode
- 📱 PWA support
- 🔗 QR code sharing

### Admin Dashboard
- ✏️ Trail & location CRUD with GPX upload
- 📦 Bulk GPX upload with similarity detection
- 🗺️ Map view of all trails with location fly-to
- 🏥 Trail health dashboard (data completeness checks)
- 🏷️ Tag management with color picker
- 📋 Audit trail (change history)
- 🔒 Supabase authentication

### Backend API
- CQRS architecture via MediatR
- GPX file processing with elevation preservation (3D LineStringZ)
- Auto-detect trail locations from GPX coordinates
- Difficulty auto-calculation per activity type
- Slug generation with Icelandic character support
- Soft-delete with audit logging
- 22+ REST API endpoints

## API Endpoints (Summary)

| Method                | Path                                   | Description                |
|-----------------------|----------------------------------------|----------------------------|
| `GET`                 | `/api/v1/trails`                       | List all published trails  |
| `GET`                 | `/api/v1/trails/{slug}`                | Get trail by slug          |
| `GET`                 | `/api/v1/trails/{slug}/geometry`       | Get trail GeoJSON geometry |
| `GET`                 | `/api/v1/trails/{slug}/gpx`            | Download trail GPX file    |
| `GET`                 | `/api/v1/locations`                    | List all locations         |
| `GET`                 | `/api/v1/locations/{slug}`             | Get location with trails   |
| `POST`                | `/api/v1/admin/trails/upload-gpx`      | Upload single GPX          |
| `POST`                | `/api/v1/admin/trails/bulk-upload-gpx` | Bulk upload GPX files      |
| `PUT`                 | `/api/v1/admin/trails/{id}`            | Update trail               |
| `DELETE`              | `/api/v1/admin/trails/{id}`            | Delete trail (soft)        |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/tags/*`                 | Tag CRUD                   |

## License

Private — all rights reserved.
