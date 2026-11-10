import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app, { localFrontendRouter } from './app';
import { connectDB } from './config/db';
import { User } from './models/User';
import { seedDatabase } from './seed/seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const startServer = async (): Promise<void> => {
  // Bind port 3000 immediately so dev server health checks succeed right away
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] doctor-tracker-api listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] Health endpoint ready at http://0.0.0.0:${PORT}/api/health`);
  });

  // Attach interactive API Explorer UI for local/preview browser access
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    localFrontendRouter.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    localFrontendRouter.use(express.static(distPath));
    localFrontendRouter.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await connectDB();

  // In local development, auto-seed if the database has no users yet
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const result = await seedDatabase();
    console.log(
      `[server] Local database seeded: ${result.doctorsCreated} doctors, ${result.patientsCreated} patients, admin: ${result.adminEmail}`
    );
  }
};

startServer().catch((err) => {
  console.error('[server] Failed to start server:', err);
  process.exit(1);
});
