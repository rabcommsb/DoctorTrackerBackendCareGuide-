import { Router } from 'express';
import {
  createDoctor,
  createDoctorPatient,
  deleteDoctorPatient,
  getDoctorById,
  getDoctorFilterOptions,
  getDoctorPatients,
  getDoctors,
} from '../controllers/doctorController.ts';
import { auth, requireRole } from '../middleware/auth.ts';

const router = Router();

// All /api/doctors routes are protected by auth + requireRole("admin")
router.use(auth, requireRole('admin'));

// Distinct specializations and hospitals for filter dropdowns (must precede /:id)
router.get('/filters/options', getDoctorFilterOptions);

// Doctor collection endpoints
router.post('/', createDoctor);
router.get('/', getDoctors);

// Single doctor & nested patient endpoints
router.get('/:id', getDoctorById);
router.get('/:id/patients', getDoctorPatients);
router.post('/:id/patients', createDoctorPatient);
router.delete('/:id/patients/:patientId', deleteDoctorPatient);

export default router;
