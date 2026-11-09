import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

// Protected by auth + requireRole("admin")
router.use(auth, requireRole('admin'));

// GET /api/dashboard/stats (?days=7|30|90)
router.get('/stats', getDashboardStats);

export default router;
