# Doctor Tracker API — B1: Setup, Models & Indexes

A standalone Node.js + Express + TypeScript backend (`doctor-tracker-api`) featuring Mongoose schemas and compound/text indexes for Users, Doctors, and Patients, automatic in-memory MongoDB fallback for zero-configuration previewing, a `/api/health` readiness endpoint, and an interactive API Status & Schema Explorer dashboard served at the root URL.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during Phase 1 clarification and govern the B1 implementation scope.

- **Confirmed Decision 1 — Database Connection & Fallback**: `MONGODB_URI` connects to an external MongoDB instance when configured, and automatically falls back to an embedded `mongodb-memory-server` instance when omitted so the backend and indexes run live in the preview environment.
- **Confirmed Decision 2 — Interactive Root Dashboard**: The Express server mounts Vite/static middleware at `/` to serve an interactive API Status & Schema Explorer view alongside the JSON API routes.
- **Confirmed Decision 3 — Strictly B1 Scope**: Focuses strictly on project setup, modular backend architecture (`config`, `models`, `controllers`, `routes`, `middleware`, `validators`, `utils`, `seed`), Mongoose models (`User`, `Doctor`, `Patient`), text and compound indexes, `GET /api/health`, and npm scripts (`dev`, `build`, `start`, `seed`).

---

### 1. Overview & Core Concept

- **What It Does**: Establishes the foundational Express + TypeScript backend and Mongoose persistence layer for tracking hospital doctors, specializations, and assigned patients, complete with full-text search and compound sorting indexes.
- **Target Audience / Persona**: Backend engineers, clinical system integrators, and healthcare administrators verifying database schemas, index registration, and service health.
- **Key Value**: Guarantees fast query performance across clinical directories and patient records via pre-built MongoDB text and compound indexes while providing immediate interactive verification of connection state, registered collections, and index definitions.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Live Health & Connection Inspection**: Opening the preview loads the Developer Console view, automatically querying `GET /api/health` to display server uptime, MongoDB connection status (External URI vs. In-Memory Fallback), and active environment configuration.
  2. **Schema & Index Verification**: Selecting any of the three core domain models (`User`, `Doctor`, `Patient`) inspects the live Mongoose schema fields, validation rules, and registered MongoDB indexes (text weights and compound sort orders).
  3. **Interactive Endpoint Ping**: Clicking the live request tester triggers real HTTP calls against `GET /api/health` and displays the formatted JSON payload, HTTP status code, and response latency in real time.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft clinical developer console (`SaaS & Developer Console` domain reference) with crisp 1px structural borders, flat single-elevation surfaces, and zero decorative clutter.
  - *Color Palette & Mood*: Clean light-first slate canvas (`#F8FAFC` background, `#FFFFFF` primary surface, `#E2E8F0` hairline dividers) with deep slate typography (`#0F172A` primary, `#475569` secondary) and clinical teal/blue primary accents (`#0284C7`). Semantic status indicators pair explicit labels with Emerald (`#16A34A` for connected/healthy), Amber (`#D97706` for fallback warning), and Crimson (`#DC2626` for disconnected/error).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` for display headings and navigation structure, `DM Sans` for scannable documentation and field descriptions, and `JetBrains Mono` with `font-variant-numeric: tabular-nums` for JSON payloads, index definitions, latencies, and timestamps.
  - *Component Styling & Layout*: Full-viewport 1440px desktop layout featuring a 3-zone top bar contract (Brand title on left, section navigation links in center, primary "Ping Health API" button on right) and single-elevation data grids with 40px compact row heights. Metadata is rendered as clean inline text separated by `·` with zero static pill badges.
- **Interactive Feedback & Motion**: Instantaneous tab switching (`< 150ms` opacity/transform transitions), skeleton loading rows during health probes, and clear error banners with retry triggers if the server connection is interrupted.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unified Express Server with Vite Middleware on Port 3000**
  - *Chosen Approach*: Run the Express application directly on port 3000 (configuring `PORT=3000` in `.env.example` and runtime defaults), mounting `/api/*` routes first and attaching Vite middleware (or static build output in production) for the root explorer UI.
  - *Why*: Satisfies the standalone Node.js + Express backend requirement while ensuring the AI Studio preview iframe on port 3000 renders an interactive verification console instead of a raw 404 page.
  - *Alternatives Considered*: Running Express on a separate port (e.g., 5000) behind a Vite proxy was passed over because standalone production (`npm start`) requires Express itself to own the primary HTTP listener.
- **Decision 2: Resilient MongoDB Connection with In-Memory Fallback**
  - *Chosen Approach*: Connect via `mongoose.connect(process.env.MONGODB_URI)` when a valid URI is supplied, and transparently provision `MongoMemoryServer` when `MONGODB_URI` is unset or points to a placeholder value, followed by `Model.syncIndexes()` on all three models.
  - *Why*: Ensures Mongoose schemas and compound/text indexes are genuinely created and verifiable inside the sandboxed environment without failing startup when no external MongoDB cluster is attached.
  - *Alternatives Considered*: Failing hard on missing `MONGODB_URI` was rejected per user confirmation in Phase 1.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Client / Preview Viewport (/)                       │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  Top Navigation Bar  │  │  Schema & Index Grid │  │ Live API Tester  │  │
│  │  (3-Zone Contract)   │  │ (User/Doctor/Patient)│  │ (GET /api/health)│  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
└─────────────┼─────────────────────────┼───────────────────────┼────────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   Express Application Server (Port 3000)                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Security & Logging Middleware: helmet · cors(CLIENT_URL) · morgan    │  │
│  └───────────────────────────────────┬──────────────────────────────────┘  │
│                                      ▼                                     │
│  ┌───────────────────────────────────┴──────────────────────────────────┐  │
│  │                        API Router (/api/*)                           │  │
│  │   • GET /api/health ──► Health Controller (status, db, indexes)      │  │
│  │   • Validators / Middleware / Utils / Seed placeholders (B1 scope)   │  │
│  └───────────────────────────────────┬──────────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     Mongoose Data Layer & Index Engine                     │
│  ┌────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │     User Model     │  │     Doctor Model     │  │   Patient Model    │  │
│  │ • email (unique)   │  │ • email (unique)     │  │ • doctor (ref)     │  │
│  │ • passwordHash     │  │ • Text: name, email, │  │ • Text: name,      │  │
│  │ • role: "admin"    │  │   hospital           │  │   phone            │  │
│  │ • timestamps       │  │ • {specialization:1, │  │ • {doctor:1,       │  │
│  │                    │  │    createdAt:-1}     │  │    createdAt:-1}   │  │
│  │                    │  │ • {hospital:1}       │  │ • {condition:1,    │  │
│  │                    │  │ • timestamps         │  │    createdAt:-1}   │  │
│  └────────────────────┘  └──────────────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **User**:
    - Fields: `email` (`String`, required, unique, lowercase, trimmed), `passwordHash` (`String`, required), `role` (`String`, enum `["admin"]`, default `"admin"`), `createdAt` & `updatedAt` (`timestamps: true`).
  - **Doctor**:
    - Fields: `name` (`String`, required, trimmed), `specialization` (`String`, required, trimmed), `hospital` (`String`, required, trimmed), `phone` (`String`, required, trimmed), `email` (`String`, required, unique, lowercase, trimmed), `createdAt` & `updatedAt` (`timestamps: true`).
    - Indexes:
      1. Text index on `{ name: "text", email: "text", hospital: "text" }`
      2. Compound index on `{ specialization: 1, createdAt: -1 }`
      3. Single-field index on `{ hospital: 1 }`
  - **Patient**:
    - Fields: `name` (`String`, required, trimmed), `age` (`Number`, required, min 0), `gender` (`String`, required, trimmed), `phone` (`String`, required, trimmed), `condition` (`String`, required, trimmed), `doctor` (`Schema.Types.ObjectId`, ref `"Doctor"`, required), `createdAt` & `updatedAt` (`timestamps: true`).
    - Indexes:
      1. Text index on `{ name: "text", phone: "text" }`
      2. Compound index on `{ doctor: 1, createdAt: -1 }`
      3. Compound index on `{ condition: 1, createdAt: -1 }`
- **Interactive Component & State Mapping**:
  - **Top Bar Primary Action ("Ping Health API")**: Triggers an asynchronous fetch to `GET /api/health`, updates the latency timer (`tabular-nums`), and refreshes the live database & index readiness state.
  - **Model Filter Tabs (`All Models` | `User` | `Doctor` | `Patient`)**: Filters the schema and index inspection tables client-side with instant state updates.
  - **Search / Filter Input**: Live text filter across field names, data types, and index specifications with an empty-state reset button when no fields match.
  - **JSON Response Drawer / Inspector**: Copies raw JSON responses from `/api/health` to the clipboard with visual confirmation feedback.
