# Doctor Tracker API (`doctor-tracker-api`)

Standalone Node.js + Express + TypeScript + Mongoose backend for clinical doctor and patient tracking, featuring stateless RFC 7519 HS256 JWT authentication, role-based access control (`admin`), compound and full-text MongoDB indexes, Zod request validation, and parallel MongoDB aggregation pipelines.

## Tech Stack
- **Runtime & Framework**: Node.js, Express, TypeScript (`tsx`)
- **Database & ODM**: MongoDB Atlas (`mongoose`) with automatic `mongodb-memory-server` fallback
- **Authentication & Security**: `jsonwebtoken` (HS256, 15m TTL), `bcryptjs`, `helmet`, `cors` (`CLIENT_URL`), `express-rate-limit`
- **Validation**: `zod`

## Environment Variables (`.env`)
Copy `.env.example` to `.env`:
```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/doctor-tracker?retryWrites=true&w=majority
JWT_SECRET=<64-char-hex-secret>
JWT_EXPIRES_IN=15m
CLIENT_URL=http://localhost:3000
```

## Scripts
- `npm run dev` — Start development server on port 3000
- `npm run seed` — Clear collections and seed 1 admin user (`admin@doctortracker.com` / `Admin@12345`), 25 doctors, and 200 patients spread over the last 60 days
- `npm run build` — Build frontend bundle to `dist/`
- `npm start` — Start server
- `npm run lint` — Type-check with TypeScript (`tsc --noEmit`)

## API Endpoints
- `GET /api/health` — Public health, environment, and index diagnostics
- `POST /api/auth/login` — Rate-limited login (`10 req / 15m`), returns `{ token, user }`
- `GET /api/auth/me` — Current authenticated admin user
- `GET /api/doctors` & `POST /api/doctors` — Paginated/searchable doctors directory & creation
- `GET /api/doctors/filters/options` — Distinct specializations and hospitals
- `GET /api/doctors/:id` — Single doctor details
- `GET /api/doctors/:id/patients`, `POST /api/doctors/:id/patients`, `DELETE /api/doctors/:id/patients/:patientId` — Doctor-scoped patient management
- `GET /api/patients`, `PATCH /api/patients/:id`, `DELETE /api/patients/:id` — Global patient directory and mutations
- `GET /api/patients/filters/options` — Distinct medical conditions
- `GET /api/dashboard/stats?days=7|30|90` — Parallel MongoDB aggregation analytics
- `POST /api/seed` — Protected on-demand database re-seed
