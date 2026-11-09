import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const doctorIdParamSchema = z.object({
  id: objectIdSchema,
});

export const doctorPatientParamsSchema = z.object({
  id: objectIdSchema,
  patientId: objectIdSchema,
});

export const createDoctorSchema = z.object({
  name: z.string().trim().min(1, 'Doctor name is required'),
  specialization: z.string().trim().min(1, 'Specialization is required'),
  hospital: z.string().trim().min(1, 'Hospital is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  email: z.string().trim().toLowerCase().email('Valid email is required'),
});

export const listDoctorsQuerySchema = z.object({
  search: z.string().trim().optional(),
  specialization: z.string().trim().optional(),
  hospital: z.string().trim().optional(),
  from: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: 'Invalid "from" date format',
    }),
  to: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: 'Invalid "to" date format',
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.string().trim().optional().default('-createdAt'),
});

export const createPatientForDoctorSchema = z.object({
  name: z.string().trim().min(1, 'Patient name is required'),
  age: z.coerce.number().int().min(0, 'Age must be a non-negative integer'),
  gender: z.string().trim().min(1, 'Gender is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  condition: z.string().trim().min(1, 'Condition is required'),
});

export const listDoctorPatientsQuerySchema = z.object({
  search: z.string().trim().optional(),
  condition: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.string().trim().optional().default('-createdAt'),
});
