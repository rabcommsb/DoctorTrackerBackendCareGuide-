import { Router } from 'express';
import {
  deletePatient,
  getPatientFilterOptions,
  getPatients,
  updatePatient,
} from '../controllers/patientController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

// All /api/patients routes are protected by auth + requireRole("admin")
router.use(auth, requireRole('admin'));

// Distinct conditions for filter dropdowns (must precede /:id)
router.get('/filters/options', getPatientFilterOptions);

// List patients with search, condition, doctor, date range, and populated doctor
router.get('/', getPatients);

// Edit and delete individual patient records
router.patch('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;
