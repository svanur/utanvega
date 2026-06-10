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

This generates local env files, starts Postgres + Auth + Kong in Docker, and seeds a local admin login. The generated credentials are printed by the setup script. If a default port is busy, the script automatically picks another free host port and writes it to `supabase/.env.local`.

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
- **Backend** → http://localhost:8080

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

Run PostgreSQL + PostGIS + Supabase Auth locally via Docker. This eliminates dependency on the hosted Supabase project for development.

### Prerequisites

- **Docker Desktop** — [Install here](https://www.docker.com/products/docker-desktop/). Must be running before executing any commands below.
- **Node.js 18+** — For running the setup script.
- **.NET 9 SDK** — For EF Core migrations.

Verify Docker is running:

```bash
docker --version
docker compose version
```

### First-time setup

Run from the **repo root** (`utanvega/`):

```bash
npm run supabase:setup
```

**What this does (in order):**
1. Generates secrets (JWT secret, Postgres password, anon/service-role keys)
2. Writes local env files (git-ignored):
   - `supabase/.env.local` — Docker Compose secrets
   - `frontend/.env.local` — Vite env pointing to local Supabase
   - `admin/.env.local` — Vite env pointing to local Supabase
3. Starts Docker containers: PostgreSQL+PostGIS, GoTrue (Auth), Kong (API gateway)
4. Waits for auth service to be healthy
5. Seeds a local admin user for the admin panel
6. Writes .NET user-secrets for the backend (`ConnectionStrings:DefaultConnection`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`)

**Output:** The script prints the local admin email and password in the terminal.

### After first-time setup: run migrations

The database starts empty. Apply EF Core migrations to create the schema:

```bash
cd backend
dotnet ef database update
```

### Daily workflow

```bash
# 1. Start the local database + auth (if not already running)
npm run supabase:up

# 2. Start the app (frontend + admin + backend)
npm run dev
```

To stop Supabase when done:

```bash
npm run supabase:down
```

### Available commands

| Command | What it does |
|---------|-------------|
| `npm run supabase:setup` | Full first-time setup (generates env, starts Docker, seeds admin, writes user-secrets) |
| `npm run supabase:up` | Start Docker containers only (assumes env files exist) |
| `npm run supabase:down` | Stop Docker containers (data persists in volume) |
| `npm run supabase:seed` | Re-seed admin user + re-write user-secrets (containers must be running) |

All commands are run from the **repo root**.

### Local endpoints

| Service | URL | Notes |
|---------|-----|-------|
| Supabase API gateway | See `supabase/.env.local` (`SUPABASE_PUBLIC_URL`) | Kong routes to auth |
| Auth health check | `SUPABASE_PUBLIC_URL` + `/auth/v1/health` | Should return `{"status":"ok"}` |
| Auth (direct) | Internal only | GoTrue runs inside Docker; use the gateway URL above |
| PostgreSQL | See `supabase/.env.local` (`LOCAL_SUPABASE_DB_PORT`) | User: `postgres`, DB: `postgres` |
| Backend API | http://localhost:8080 | After running `npm run dev` |
| Frontend | http://localhost:5173 | After running `npm run dev` |
| Admin | http://localhost:5174 | After running `npm run dev` |

### Connecting with a database client

Use any PostgreSQL client (pgAdmin, DBeaver, DataGrip, `psql`):

```
Host: localhost
Port: 5432
Database: postgres
Username: postgres
Password: (check supabase/.env.local → POSTGRES_PASSWORD)
```

### Reset everything (nuclear option)

Destroys all local data and recreates from scratch:

```bash
npm run supabase:down
docker volume rm hlaupadagskra-supabase-local_db-data
npm run supabase:setup
cd backend && dotnet ef database update
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `port 5432 already in use` | Stop any local PostgreSQL service, or change the port in `docker-compose.local.yml` |
| Auth container keeps restarting | Check logs: `docker logs hlaupadagskra-supabase-auth` — usually a role password mismatch. Reset with nuclear option above. |
| `dotnet ef database update` fails | Ensure containers are running (`npm run supabase:up`) and check connection string in user-secrets |
| Admin login doesn't work | Run `npm run supabase:seed` to re-create the admin user |
| Docker not found | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running |

### Notes

- All `*.env.local` files are git-ignored — safe to contain secrets.
- The Docker volume (`db-data`) persists data across `supabase:down` / `supabase:up` cycles.
- Only `docker volume rm` or the nuclear reset destroys data.
- Keep production/staging Supabase credentials in separate env files or user-secrets, never in `.env.local`.

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
