import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Doctor } from '../models/Doctor.ts';
import { Patient } from '../models/Patient.ts';
import {
  createDoctorSchema,
  createPatientForDoctorSchema,
  doctorIdParamSchema,
  doctorPatientParamsSchema,
  listDoctorPatientsQuerySchema,
  listDoctorsQuerySchema,
} from '../validators/doctorValidator.ts';
import {
  buildDateRangeFilter,
  buildPaginationMeta,
  getPaginationParams,
  parseSortParam,
} from '../utils/queryHelpers.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

/**
 * POST /api/doctors
 * Creates a new doctor. Returns 409 Conflict if email already exists.
 */
export const createDoctor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const validated = createDoctorSchema.parse(req.body);

  const existing = await Doctor.findOne({ email: validated.email }).lean();
  if (existing) {
    res.status(409).json({
      status: 'error',
      code: 'DOCTOR_EMAIL_EXISTS',
      message: 'A doctor with this email already exists.',
    });
    return;
  }

  const doctor = await Doctor.create(validated);
  res.status(201).json({
    status: 'ok',
    data: doctor.toObject(),
    doctor: doctor.toObject(),
  });
});

/**
 * GET /api/doctors
 * Query params: search, specialization, hospital, from, to (date range on createdAt),
 * page (default 1), limit (default 10, max 50), sort.
 * Reuses shared pagination and date-range filter helpers in src/utils/queryHelpers.ts.
 */
export const getDoctors = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listDoctorsQuerySchema.parse(req.query);
  const {
    search,
    specialization,
    hospital,
    from,
    to,
    page: rawPage,
    limit: rawLimit,
    sort,
  } = query;

  const filter: Record<string, unknown> = {};

  if (search && search.length > 0) {
    filter.$text = { $search: search };
  }

  if (specialization && specialization.length > 0) {
    filter.specialization = specialization;
  }

  if (hospital && hospital.length > 0) {
    filter.hospital = hospital;
  }

  const createdAtFilter = buildDateRangeFilter(from, to);
  if (createdAtFilter) {
    filter.createdAt = createdAtFilter;
  }

  const { page, limit, skip } = getPaginationParams(rawPage, rawLimit, 50);
  const sortSpec = parseSortParam(sort, [
    'createdAt',
    'updatedAt',
    'name',
    'specialization',
    'hospital',
    'email',
  ]);

  const [data, total] = await Promise.all([
    Doctor.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
  ]);

  res.status(200).json({
    data,
    pagination: buildPaginationMeta(total, page, limit),
  });
});

/**
 * GET /api/doctors/filters/options
 * Returns distinct specializations and hospitals for filter dropdowns.
 */
export const getDoctorFilterOptions = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const [rawSpecializations, rawHospitals] = await Promise.all([
      Doctor.distinct('specialization'),
      Doctor.distinct('hospital'),
    ]);

    const specializations = (rawSpecializations as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const hospitals = (rawHospitals as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      specializations,
      hospitals,
      data: {
        specializations,
        hospitals,
      },
    });
  }
);

/**
 * GET /api/doctors/:id
 * Returns a single doctor by ObjectId. Returns 404 if not found.
 */
export const getDoctorById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = doctorIdParamSchema.parse(req.params);

  const doctor = await Doctor.findById(id).lean();
  if (!doctor) {
    res.status(404).json({
      status: 'error',
      code: 'DOCTOR_NOT_FOUND',
      message: 'Doctor not found.',
    });
    return;
  }

  res.status(200).json({
    data: doctor,
    doctor,
  });
});

/**
 * GET /api/doctors/:id/patients
 * Lists patients belonging to this doctor, with text search and shared pagination helper.
 */
export const getDoctorPatients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = doctorIdParamSchema.parse(req.params);
  const query = listDoctorPatientsQuerySchema.parse(req.query);
  const { search, condition, page: rawPage, limit: rawLimit, sort } = query;

  const doctorExists = await Doctor.exists({ _id: id });
  if (!doctorExists) {
    res.status(404).json({
      status: 'error',
      code: 'DOCTOR_NOT_FOUND',
      message: 'Doctor not found.',
    });
    return;
  }

  const filter: Record<string, unknown> = {
    doctor: new Types.ObjectId(id),
  };

  if (search && search.length > 0) {
    filter.$text = { $search: search };
  }

  if (condition && condition.length > 0) {
    filter.condition = condition;
  }

  const { page, limit, skip } = getPaginationParams(rawPage, rawLimit, 50);
  const sortSpec = parseSortParam(sort, [
    'createdAt',
    'updatedAt',
    'name',
    'age',
    'condition',
  ]);

  const [data, total] = await Promise.all([
    Patient.find(filter).sort(sortSpec).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);

  res.status(200).json({
    data,
    pagination: buildPaginationMeta(total, page, limit),
  });
});

/**
 * POST /api/doctors/:id/patients
 * Adds a patient under this doctor (name, age, gender, phone, condition).
 */
export const createDoctorPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = doctorIdParamSchema.parse(req.params);
  const validatedBody = createPatientForDoctorSchema.parse(req.body);

  const doctor = await Doctor.findById(id).lean();
  if (!doctor) {
    res.status(404).json({
      status: 'error',
      code: 'DOCTOR_NOT_FOUND',
      message: 'Doctor not found.',
    });
    return;
  }

  const patient = await Patient.create({
    ...validatedBody,
    doctor: new Types.ObjectId(id),
  });

  res.status(201).json({
    status: 'ok',
    data: patient.toObject(),
    patient: patient.toObject(),
  });
});

/**
 * DELETE /api/doctors/:id/patients/:patientId
 * Deletes the patient only if it belongs to the specified doctor.
 * Returns 404 if the doctor is missing or the patient does not belong to that doctor.
 */
export const deleteDoctorPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id, patientId } = doctorPatientParamsSchema.parse(req.params);

  const doctorExists = await Doctor.exists({ _id: id });
  if (!doctorExists) {
    res.status(404).json({
      status: 'error',
      code: 'DOCTOR_NOT_FOUND',
      message: 'Doctor not found.',
    });
    return;
  }

  const deletedPatient = await Patient.findOneAndDelete({
    _id: new Types.ObjectId(patientId),
    doctor: new Types.ObjectId(id),
  }).lean();

  if (!deletedPatient) {
    res.status(404).json({
      status: 'error',
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient not found for this doctor.',
    });
    return;
  }

  res.status(200).json({
    status: 'ok',
    message: 'Patient deleted successfully.',
    data: deletedPatient,
  });
});
