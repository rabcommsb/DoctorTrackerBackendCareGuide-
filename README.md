# Doctor Tracker API (`doctor-tracker-api`)

Standalone Node.js + Express + TypeScript + Mongoose backend for clinical doctor and patient tracking, featuring stateless RFC 7519 HS256 JWT authentication, role-based access control (`admin`), compound and full-text MongoDB indexes, Zod request validation, and parallel MongoDB aggregation pipelines.

## Tech Stack
- **Runtime & Framework**: Node.js (`>=20.0.0`), Express, TypeScript (`tsx`)
- **Database & ODM**: MongoDB Atlas (`mongoose`) with automatic `mongodb-memory-server` fallback
- **Authentication & Security**: `jsonwebtoken` (HS256, 15m TTL), `bcryptjs`, `helmet`, `cors` (`CLIENT_URL`), `express-rate-limit`
- **Validation**: `zod`

## Render Deployment Settings
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Port**: Automatically binds to `process.env.PORT` (defaults to `3000` locally)

## Environment Variables
| Key | Example / Value | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production security defaults |
| `PORT` | `10000` (auto-set by Render) | Port the Express server listens on |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/doctor-tracker?retryWrites=true&w=majority` | MongoDB Atlas connection string |
| `JWT_SECRET` | `a3f8c2e1d94b7f6a0c5e8d2b1f4a7c9e3d6b8a2f5c1e4d7b0a9f3c6e2d8b5a1f` | 256-bit (64-hex-char) secret for signing HS256 JWTs |
| `JWT_EXPIRES_IN` | `15m` | Access token lifespan |
| `CLIENT_URL` | `https://your-frontend.vercel.app` | Allowed frontend origin(s) for CORS (comma-separated supported) |

## Scripts
- `npm run dev` — Start development server on port 3000
- `npm run build` — Build frontend bundle to `dist/`
- `npm start` — Start production Express server (`tsx src/server.ts`)
- `npm run seed` — Clear collections and seed 1 admin user (`admin@doctortracker.com` / `Admin@12345`), 25 doctors, and 200 patients spread over the last 60 days
- `npm run lint` — Type-check with TypeScript (`tsc --noEmit`)
