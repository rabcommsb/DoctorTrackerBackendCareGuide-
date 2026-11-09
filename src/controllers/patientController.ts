import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Patient } from '../models/Patient.ts';
import { Doctor } from '../models/Doctor.ts';
import {
  listPatientsQuerySchema,
  patientIdParamSchema,
  updatePatientSchema,
} from '../validators/patientValidator.ts';
import {
  buildDateRangeFilter,
  buildPaginationMeta,
  getPaginationParams,
  parseSortParam,
} from '../utils/queryHelpers.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

/**
 * GET /api/patients
 * Query params: search, condition, doctor, from, to (date range on createdAt), page, limit, sort.
 * Uses skip/limit with parallel countDocuments, .lean(), and populates doctor with only name and specialization.
 * Returns { data, pagination }.
 */
export const getPatients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = listPatientsQuerySchema.parse(req.query);
  const {
    search,
    condition,
    doctor,
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

  if (condition && condition.length > 0) {
    filter.condition = condition;
  }

  if (doctor && doctor.length > 0) {
    filter.doctor = new Types.ObjectId(doctor);
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
    'age',
    'condition',
    'gender',
  ]);

  const [data, total] = await Promise.all([
    Patient.find(filter)
      .populate('doctor', 'name specialization')
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  res.status(200).json({
    data,
    pagination: buildPaginationMeta(total, page, limit),
  });
});

/**
 * GET /api/patients/filters/options
 * Returns distinct patient conditions for filter dropdowns.
 */
export const getPatientFilterOptions = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const rawConditions = await Patient.distinct('condition');
    const conditions = (rawConditions as string[])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      conditions,
      data: {
        conditions,
      },
    });
  }
);

/**
 * PATCH /api/patients/:id
 * Partially updates a patient record after validating ObjectId and partial body fields.
 */
export const updatePatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = patientIdParamSchema.parse(req.params);
  const updates = updatePatientSchema.parse(req.body);

  if (updates.doctor) {
    const doctorExists = await Doctor.exists({ _id: updates.doctor });
    if (!doctorExists) {
      res.status(404).json({
        status: 'error',
        code: 'DOCTOR_NOT_FOUND',
        message: 'Assigned doctor not found.',
      });
      return;
    }
  }

  const updatePayload: Record<string, unknown> = { ...updates };
  if (updates.doctor) {
    updatePayload.doctor = new Types.ObjectId(updates.doctor);
  }

  const updatedPatient = await Patient.findByIdAndUpdate(
    id,
    { $set: updatePayload },
    { new: true, runValidators: true }
  )
    .populate('doctor', 'name specialization')
    .lean();

  if (!updatedPatient) {
    res.status(404).json({
      status: 'error',
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient not found.',
    });
    return;
  }

  res.status(200).json({
    status: 'ok',
    data: updatedPatient,
    patient: updatedPatient,
  });
});

/**
 * DELETE /api/patients/:id
 * Deletes a patient by ObjectId. Returns 404 if missing.
 */
export const deletePatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = patientIdParamSchema.parse(req.params);

  const deletedPatient = await Patient.findByIdAndDelete(id).lean();
  if (!deletedPatient) {
    res.status(404).json({
      status: 'error',
      code: 'PATIENT_NOT_FOUND',
      message: 'Patient not found.',
    });
    return;
  }

  res.status(200).json({
    status: 'ok',
    message: 'Patient deleted successfully.',
    data: deletedPatient,
  });
});
