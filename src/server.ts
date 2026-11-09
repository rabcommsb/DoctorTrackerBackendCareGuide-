import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.ts';
import { User } from './models/User.ts';
import { Doctor } from './models/Doctor.ts';
import { Patient } from './models/Patient.ts';
import healthRoutes from './routes/healthRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import doctorRoutes from './routes/doctorRoutes.ts';
import patientRoutes from './routes/patientRoutes.ts';
import dashboardRoutes from './routes/dashboardRoutes.ts';
import { auth, requireRole } from './middleware/auth.ts';
import { asyncHandler, errorHandler, notFound } from './middleware/errorHandler.ts';
import { seedDatabase } from './seed/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = async () => {
  const app = express();

  // Trust proxy for accurate client IP detection in express-rate-limit behind reverse proxies
  app.set('trust proxy', 1);

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  // CORS configured with CLIENT_URL origin
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  app.use(
    cors({
      origin: clientUrl,
      credentials: true,
    })
  );

  // Request logging and 1mb JSON body limit
  app.use(morgan('dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Public health check endpoint: GET /api/health
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

  // Auth routes (/api/auth/login, /api/auth/me, /api/auth/logout, /api/auth/verify-diagnostic)
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

  // Catch-all 404 notFound handler for unmatched /api/* endpoints
  app.use('/api', notFound);

  // Serve interactive API Status & Schema Explorer on root in dev and prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Fallback notFound for unmatched routes
  app.use(notFound);

  // Central error-handling middleware
  app.use(errorHandler);

  return app;
};

const startServer = async () => {
  const port = Number(process.env.PORT || 3000);

  await connectDB();

  // Synchronize indexes for each model on startup
  await Promise.all([
    User.syncIndexes(),
    Doctor.syncIndexes(),
    Patient.syncIndexes(),
  ]);

  const app = await createApp();

  app.listen(port, '0.0.0.0', () => {
    console.log(`[server] doctor-tracker-api listening on http://0.0.0.0:${port}`);
    console.log(`[server] Health endpoint ready at http://0.0.0.0:${port}/api/health`);
  });
};

startServer().catch((err) => {
  console.error('[server] Failed to start server:', err);
  process.exit(1);
});
