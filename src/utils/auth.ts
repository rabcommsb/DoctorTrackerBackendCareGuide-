import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions, VerifyOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Response } from 'express';

const { JsonWebTokenError, NotBeforeError, TokenExpiredError } = jwt;

/**
 * RFC 7519 Algorithm Whitelist
 * Explicitly pins HMAC-SHA256 to prevent `alg: none` and RSA/HMAC key-confusion attacks.
 */
export const ALLOWED_JWT_ALGORITHMS: jwt.Algorithm[] = ['HS256'];
export const DEFAULT_ACCESS_TOKEN_TTL = '15m'; // 900 seconds
export const DEFAULT_REFRESH_TOKEN_TTL = '7d';

const TIMESPAN_REGEX = /^\d+\s*(ms|s|m|h|d|w|y)?$/i;

export const resolveAccessExpiresIn = (): string => {
  const raw = process.env.JWT_EXPIRES_IN?.trim();
  return raw && TIMESPAN_REGEX.test(raw) ? raw : DEFAULT_ACCESS_TOKEN_TTL;
};

export const resolveRefreshExpiresIn = (): string => {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN?.trim();
  return raw && TIMESPAN_REGEX.test(raw) ? raw : DEFAULT_REFRESH_TOKEN_TTL;
};

/**
 * Ephemeral CSPRNG fallback generated strictly via `node:crypto` (256-bit / 32 bytes)
 * when `process.env.JWT_SECRET` is not injected in local/preview sandboxes.
 * Production environments strictly require `process.env.JWT_SECRET` (>= 32 bytes).
 */
const runtimeEphemeralAccessSecret = crypto.randomBytes(32).toString('hex');
const runtimeEphemeralRefreshSecret = crypto.randomBytes(32).toString('hex');

export const getAccessSecret = (): string => {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL SECURITY FAULT: JWT_SECRET environment variable must be set and contain at least 256 bits (32 characters) of entropy in production.'
    );
  }
  return runtimeEphemeralAccessSecret;
};

export const getRefreshSecret = (): string => {
  const envRefreshSecret = process.env.JWT_REFRESH_SECRET?.trim();
  if (envRefreshSecret && envRefreshSecret.length >= 32) {
    return envRefreshSecret;
  }
  const envAccessSecret = process.env.JWT_SECRET?.trim();
  if (envAccessSecret && envAccessSecret.length >= 32) {
    return crypto
      .createHmac('sha256', envAccessSecret)
      .update('doctor-tracker-refresh-secret')
      .digest('hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL SECURITY FAULT: JWT_SECRET environment variable must be set and contain at least 256 bits (32 characters) of entropy in production.'
    );
  }
  return runtimeEphemeralRefreshSecret;
};

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: 'admin';
  type: 'access';
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenClaims {
  sub: string;
  email: string;
  role: 'admin';
  type: 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

export const signAccessToken = (payload: {
  sub: string;
  email: string;
  role: 'admin';
}): string => {
  const expiresIn = resolveAccessExpiresIn() as SignOptions['expiresIn'];

  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn,
    jwtid: crypto.randomUUID(),
    issuer: 'doctor-tracker-api',
    audience: 'doctor-tracker-client',
  };

  return jwt.sign({ ...payload, type: 'access' }, getAccessSecret(), options);
};

export const signRefreshToken = (payload: {
  sub: string;
  email: string;
  role: 'admin';
}): string => {
  const expiresIn = resolveRefreshExpiresIn() as SignOptions['expiresIn'];

  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn,
    jwtid: crypto.randomUUID(),
    issuer: 'doctor-tracker-api',
    audience: 'doctor-tracker-client',
  };

  return jwt.sign({ ...payload, type: 'refresh' }, getRefreshSecret(), options);
};

export const verifyAccessToken = (token: string): AccessTokenClaims => {
  const verifyOptions: VerifyOptions = {
    algorithms: ALLOWED_JWT_ALGORITHMS, // Rejects `alg: none` and asymmetric confusion
    issuer: 'doctor-tracker-api',
    audience: 'doctor-tracker-client',
  };

  const decoded = jwt.verify(
    token,
    getAccessSecret(),
    verifyOptions
  ) as AccessTokenClaims;

  if (decoded.type !== 'access') {
    throw new JsonWebTokenError('Invalid token type: expected access token');
  }

  return decoded;
};

export const verifyRefreshToken = (token: string): RefreshTokenClaims => {
  const verifyOptions: VerifyOptions = {
    algorithms: ALLOWED_JWT_ALGORITHMS,
    issuer: 'doctor-tracker-api',
    audience: 'doctor-tracker-client',
  };

  const decoded = jwt.verify(
    token,
    getRefreshSecret(),
    verifyOptions
  ) as RefreshTokenClaims;

  if (decoded.type !== 'refresh') {
    throw new JsonWebTokenError('Invalid token type: expected refresh token');
  }

  return decoded;
};

/**
 * Hardened Cookie Configuration to mitigate Cross-Site Scripting (XSS) & CSRF extraction.
 */
export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes (900,000 ms)
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh',
  });
};

export const clearAuthCookies = (res: Response): void => {
  const isProd = process.env.NODE_ENV === 'production';

  res.clearCookie('access_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  });

  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth/refresh',
  });
};

export const hashPassword = async (plainText: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
};

export const comparePassword = async (
  plainText: string,
  passwordHash: string
): Promise<boolean> => {
  return bcrypt.compare(plainText, passwordHash);
};

export { TokenExpiredError, JsonWebTokenError, NotBeforeError };
