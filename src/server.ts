import 'dotenv/config';
import app from './app.ts';
import { connectDB } from './config/db.ts';
import { User } from './models/User.ts';
import { seedDatabase } from './seed/seed.ts';

const PORT = Number(process.env.PORT || 3000);

const startServer = async (): Promise<void> => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] doctor-tracker-api listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] Health endpoint ready at http://0.0.0.0:${PORT}/api/health`);
  });

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
