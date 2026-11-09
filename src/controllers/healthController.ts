import { Request, Response } from 'express';
import { connectDB, getDbStatus } from '../config/db.ts';
import {
  ALLOWED_JWT_ALGORITHMS,
  DEFAULT_ACCESS_TOKEN_TTL,
  DEFAULT_REFRESH_TOKEN_TTL,
} from '../utils/auth.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const getHealth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (req.query.reconnect === 'true') {
    await connectDB(true);
  }
  const dbStatus = await getDbStatus();
  const envSecret = process.env.JWT_SECRET?.trim() || '';

  res.status(200).json({
    status: 'ok',
    service: 'doctor-tracker-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: Number(process.env.PORT || 3000),
      clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
      jwtConfigured: envSecret.length >= 32,
      jwtSecretSource:
        envSecret.length >= 32
          ? 'process.env.JWT_SECRET (>=256-bit)'
          : 'node:crypto.randomBytes(32) ephemeral CSPRNG',
      jwtAllowedAlgorithms: ALLOWED_JWT_ALGORITHMS,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_TTL,
      jwtRefreshExpiresIn:
        process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_TTL,
      cookiePolicy: 'HttpOnly; Secure (prod); SameSite=Strict',
    },
    database: dbStatus,
  });
});
