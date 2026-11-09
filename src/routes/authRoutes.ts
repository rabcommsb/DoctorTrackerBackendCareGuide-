import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getMe,
  login,
  logout,
  runJwtSecurityDiagnostic,
} from '../controllers/authController.ts';
import { auth, requireRole } from '../middleware/auth.ts';

const router = Router();

/**
 * Rate limiter on POST /api/auth/login:
 * 10 requests per 15 minutes per IP address.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max 10 requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  },
});

// Public login route with rate limiting (10 req / 15 min)
router.post('/login', loginRateLimiter, login);

// Protected routes (auth + requireRole("admin"))
router.get('/me', auth, requireRole('admin'), getMe);
router.post('/logout', auth, requireRole('admin'), logout);
router.post('/verify-diagnostic', auth, requireRole('admin'), runJwtSecurityDiagnostic);

export default router;
