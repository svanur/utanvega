# 🏔️ Útanvega — Trail Discovery for Iceland

A web application for finding and sharing trails in Iceland. Browse trails on a map, filter by activity type, difficulty, location, and tags — or explore elevation profiles with interactive charts and route playback.

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

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Recharts 3 |
| **Admin** | React 18, TypeScript, Vite 7, MUI 5, Leaflet, Supabase Auth |
| **Backend** | .NET 9, MediatR (CQRS), EF Core, PostGIS, JWT Auth |
| **Database** | PostgreSQL + PostGIS (via Supabase) |
| **Tests** | xUnit, Moq, SQLite in-memory |
| **Hosting** | Fly.io (backend), Vercel (frontend) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [.NET 9 SDK](https://dotnet.microsoft.com/)
- PostgreSQL with PostGIS (or a Supabase project)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/utanvega.git
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
dotnet user-secrets set "Jwt:Secret" "your-supabase-jwt-secret"
```

### 3. Run database migrations

```bash
cd backend
dotnet ef database update
```

### 4. Start all projects

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

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/trails` | List all published trails |
| `GET` | `/api/v1/trails/{slug}` | Get trail by slug |
| `GET` | `/api/v1/trails/{slug}/geometry` | Get trail GeoJSON geometry |
| `GET` | `/api/v1/trails/{slug}/gpx` | Download trail GPX file |
| `GET` | `/api/v1/locations` | List all locations |
| `GET` | `/api/v1/locations/{slug}` | Get location with trails |
| `POST` | `/api/v1/admin/trails/upload-gpx` | Upload single GPX |
| `POST` | `/api/v1/admin/trails/bulk-upload-gpx` | Bulk upload GPX files |
| `PUT` | `/api/v1/admin/trails/{id}` | Update trail |
| `DELETE` | `/api/v1/admin/trails/{id}` | Delete trail (soft) |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/tags/*` | Tag CRUD |

## License

Private — all rights reserved.
