import 'dotenv/config';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import morgan from 'morgan';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import doctorRoutes from './routes/doctorRoutes';
import patientRoutes from './routes/patientRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { auth, requireRole } from './middleware/auth';
import {
  asyncHandler,
  errorHandler,
  notFound,
} from './middleware/errorHandler';
import { seedDatabase } from './seed/seed';

/**
 * Builds and exports the Express application (middleware, routes, error handlers)
 * WITHOUT calling `app.listen()` or connecting to MongoDB.
 */
const app = express();

// Optional router used only by src/server.ts for local preview UI
export const localFrontendRouter = Router();

// Trust reverse proxy headers (Vercel / Render)
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

// 1. CORS Configuration:
// - origin: process.env.CLIENT_URL (stripped of any trailing slash)
// - methods: GET, POST, PATCH, DELETE, OPTIONS
// - allowedHeaders: Content-Type, Authorization
const clientUrl = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.trim().replace(/\/+$/, '')
  : 'http://localhost:3000';

const corsOptions: CorsOptions = {
  origin: clientUrl,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes before authentication middleware
app.options('*', cors(corsOptions));

// Logging & 1mb JSON body parser
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 2. Public Health Route: GET /api/health -> {"status":"ok", ...}
app.use('/api', healthRoutes);

// Global API Authentication & Authorization Guard:
// Applies `auth` + `requireRole("admin")` to ALL /api/* routes except
// OPTIONS preflight, POST /api/auth/login, and GET /api/health
app.use('/api', (req, res, next) => {
  if (
    req.method === 'OPTIONS' ||
    (req.path === '/auth/login' && req.method === 'POST') ||
    (req.path === '/health' && req.method === 'GET')
  ) {
    next();
    return;
  }

  auth(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    requireRole('admin')(req, res, next);
  });
});

// Mounted /api/* routes:
// - /api/auth/login, /api/auth/me, /api/auth/logout
app.use('/api/auth', authRoutes);

// - /api/doctors, /api/doctors/filters/options, /api/doctors/:id, /api/doctors/:id/patients
app.use('/api/doctors', doctorRoutes);

// - /api/patients, /api/patients/filters/options, /api/patients/:id
app.use('/api/patients', patientRoutes);

// - /api/dashboard/stats
app.use('/api/dashboard', dashboardRoutes);

// - /api/seed (protected on-demand database seed)
app.post(
  '/api/seed',
  asyncHandler(async (_req, res) => {
    const result = await seedDatabase();
    res.status(200).json({
      status: 'ok',
      message: 'Database seeded successfully with B6 dataset.',
      data: result,
    });
  })
);

// Catch-all 404 for unmatched /api/* routes
app.use('/api', notFound);

// Root endpoint GET / -> {"status":"ok"} on Vercel or API clients
app.get('/', (req, res, next) => {
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  if (process.env.VERCEL || req.query.format === 'json' || !acceptsHtml) {
    res.status(200).json({
      status: 'ok',
      service: 'doctor-tracker-api',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
});

// Mount optional local preview router (used only by src/server.ts in local dev)
app.use(localFrontendRouter);

// Fallback GET / returning {"status":"ok"}
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'doctor-tracker-api',
    timestamp: new Date().toISOString(),
  });
});

// 404 Not Found handler
app.use(notFound);

// Central Error Handler
app.use(errorHandler);

export { app };
export default app;
