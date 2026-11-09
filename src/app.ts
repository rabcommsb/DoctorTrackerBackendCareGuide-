import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import healthRoutes from './routes/healthRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import doctorRoutes from './routes/doctorRoutes.ts';
import patientRoutes from './routes/patientRoutes.ts';
import dashboardRoutes from './routes/dashboardRoutes.ts';
import { auth, requireRole } from './middleware/auth.ts';
import {
  asyncHandler,
  errorHandler,
  notFound,
} from './middleware/errorHandler.ts';
import { seedDatabase } from './seed/seed.ts';

/**
 * Builds and exports the Express application (middleware, routes, error handlers)
 * WITHOUT calling `app.listen()` or connecting to MongoDB at import time.
 */
const app = express();

// Trust proxy for accurate client IP detection behind Vercel / Render reverse proxies
app.set('trust proxy', 1);

// Security headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  })
);

// CORS configured with CLIENT_URL origin (supports comma-separated origins & strips trailing slashes)
const rawClientUrl = process.env.CLIENT_URL?.trim();
const allowedOrigins =
  rawClientUrl && rawClientUrl.startsWith('http')
    ? rawClientUrl
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      const normalizedRequestOrigin = requestOrigin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedRequestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins[0]);
    },
    credentials: true,
  })
);

// Request logging and 1mb JSON body limit
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Public root health endpoint: GET / -> {"status":"ok"}
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'doctor-tracker-api',
    timestamp: new Date().toISOString(),
  });
});

// Public health check endpoint: GET /api/health -> {"status":"ok", ...}
app.use('/api', healthRoutes);

// Global API Authentication & Authorization Guard:
// Applies `auth` + `requireRole("admin")` to ALL /api/* routes except
// POST /api/auth/login and GET /api/health
app.use('/api', (req, res, next) => {
  if (
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

// B2 Auth routes (/api/auth/login, /api/auth/me, /api/auth/logout, /api/auth/verify-diagnostic)
app.use('/api/auth', authRoutes);

// B3 Doctor management routes (/api/doctors)
app.use('/api/doctors', doctorRoutes);

// B4 Patient management routes (/api/patients)
app.use('/api/patients', patientRoutes);

// B5 Dashboard analytics routes (/api/dashboard/stats)
app.use('/api/dashboard', dashboardRoutes);

// B6 On-demand Seed endpoint (protected by auth + requireRole("admin"))
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

// 404 Not Found handler
app.use(notFound);

// Central Error Handler
app.use(errorHandler);

export { app };
export default app;
