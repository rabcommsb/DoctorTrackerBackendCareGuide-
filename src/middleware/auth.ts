import { Request, Response, NextFunction } from 'express';
import {
  AccessTokenClaims,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verifyAccessToken,
} from '../utils/auth';

export interface AuthenticatedUser {
  id: string;
  _id: string;
  sub: string;
  email: string;
  role: 'admin' | string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Extracts JWT from `Authorization: Bearer <token>` header (primary)
 * or `HttpOnly` cookie (`access_token`) fallback.
 */
const extractBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    const match = rawCookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='));
    if (match) {
      return decodeURIComponent(match.split('=')[1] || '');
    }
  }

  return null;
};

/**
 * Middleware: Verifies Bearer JWT using RFC 7519 HS256 whitelist,
 * attaches `req.user`, and returns 401 Unauthorized if missing, expired, or invalid.
 */
export const auth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      status: 'error',
      code: 'AUTH_TOKEN_MISSING',
      message: 'Authentication required. Missing Bearer token.',
    });
    return;
  }

  try {
    const decoded: AccessTokenClaims = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      _id: decoded.sub,
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired.',
        expiredAt: err.expiredAt.toISOString(),
      });
      return;
    }

    if (err instanceof NotBeforeError) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_NOT_ACTIVE',
        message: 'Token is not yet active.',
      });
      return;
    }

    if (err instanceof JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        code: 'INVALID_TOKEN',
        message: 'Invalid or malformed authentication token.',
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication failed.',
    });
  }
};

/**
 * Role-based authorization middleware factory: `requireRole("admin")`
 * Must be used after `auth` middleware.
 */
export const requireRole = (requiredRole: 'admin' | string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (req.user.role !== requiredRole) {
      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: `Forbidden: requires "${requiredRole}" role.`,
      });
      return;
    }

    next();
  };
};

export default auth;
