import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.ts';
import {
  ALLOWED_JWT_ALGORITHMS,
  DEFAULT_ACCESS_TOKEN_TTL,
  JsonWebTokenError,
  TokenExpiredError,
  clearAuthCookies,
  comparePassword,
  getAccessSecret,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from '../utils/auth.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { loginSchema } from '../validators/authValidator.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

/**
 * POST /api/auth/login
 * - Validates { email, password } with Zod
 * - Compares password hash with bcryptjs
 * - Returns generic "Invalid credentials" (401) for any validation or auth failure
 * - Issues short-lived HS256 JWT (15m default) + HttpOnly/Secure/SameSite=Strict cookie
 * - Returns { token, user }
 */
export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid credentials',
    });
    return;
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid credentials',
    });
    return;
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid credentials',
    });
    return;
  }

  const payload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
  };

  const token = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Set hardened HttpOnly, Secure, SameSite=Strict cookies alongside Bearer token response
  setAuthCookies(res, token, refreshToken);

  res.status(200).json({
    token,
    user: {
      id: String(user._id),
      _id: String(user._id),
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_TTL,
  });
});

/**
 * GET /api/auth/me
 * Protected by `auth` + `requireRole("admin")`.
 * Returns the currently authenticated admin user from database.
 */
export const getMe = asyncHandler<AuthRequest>(
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
      });
      return;
    }

    const dbUser = await User.findById(req.user.id).select('-passwordHash');
    if (!dbUser) {
      res.status(401).json({
        status: 'error',
        message: 'User no longer exists',
      });
      return;
    }

    res.status(200).json({
      user: {
        id: String(dbUser._id),
        _id: String(dbUser._id),
        email: dbUser.email,
        role: dbUser.role,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      },
    });
  }
);

/**
 * POST /api/auth/logout
 * Clears HttpOnly cookies.
 */
export const logout = (_req: Request, res: Response): void => {
  clearAuthCookies(res);
  res.status(200).json({
    status: 'ok',
    message: 'Logged out successfully',
  });
};

/**
 * POST /api/auth/verify-diagnostic
 * Interactive RFC 7519 security diagnostic endpoint (requires admin auth).
 */
export const runJwtSecurityDiagnostic = (
  req: Request,
  res: Response
): void => {
  const scenario: 'valid' | 'expired' | 'alg_none' =
    req.body?.scenario || 'valid';

  let candidateToken = '';

  if (scenario === 'valid') {
    candidateToken = signAccessToken({
      sub: '673000000000000000000001',
      email: 'admin@doctortracker.com',
      role: 'admin',
    });
  } else if (scenario === 'expired') {
    candidateToken = jwt.sign(
      {
        sub: '673000000000000000000001',
        email: 'admin@doctortracker.com',
        role: 'admin',
        type: 'access',
      },
      getAccessSecret(),
      {
        algorithm: 'HS256',
        expiresIn: -60,
        issuer: 'doctor-tracker-api',
        audience: 'doctor-tracker-client',
      }
    );
  } else if (scenario === 'alg_none') {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: '673000000000000000000001',
        email: 'attacker@hospital.org',
        role: 'admin',
        type: 'access',
      })
    ).toString('base64url');
    candidateToken = `${header}.${payload}.`;
  }

  try {
    const verifiedClaims = verifyAccessToken(candidateToken);
    res.status(200).json({
      status: 'ok',
      scenario,
      httpStatus: 200,
      allowedAlgorithms: ALLOWED_JWT_ALGORITHMS,
      tokenSample: `${candidateToken.slice(0, 36)}...`,
      verifiedClaims,
    });
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        scenario,
        httpStatus: 401,
        code: 'TOKEN_EXPIRED',
        errorType: 'TokenExpiredError',
        message: 'Access token expired — gracefully rejected with 401 Unauthorized.',
        expiredAt: err.expiredAt.toISOString(),
        allowedAlgorithms: ALLOWED_JWT_ALGORITHMS,
      });
      return;
    }

    if (err instanceof JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        scenario,
        httpStatus: 401,
        code: 'INVALID_TOKEN',
        errorType: 'JsonWebTokenError',
        message: `Rejected by RFC 7519 verifier: ${err.message}`,
        allowedAlgorithms: ALLOWED_JWT_ALGORITHMS,
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      scenario,
      httpStatus: 401,
      message: 'Authentication verification failed',
    });
  }
};
