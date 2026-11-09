import { z } from 'zod';
import { objectIdSchema } from './doctorValidator.ts';

export const patientIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listPatientsQuerySchema = z.object({
  search: z.string().trim().optional(),
  condition: z.string().trim().optional(),
  doctor: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[0-9a-fA-F]{24}$/.test(val), {
      message: 'Invalid doctor ObjectId format',
    }),
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

export const updatePatientSchema = z
  .object({
    name: z.string().trim().min(1, 'Patient name cannot be empty').optional(),
    age: z.coerce
      .number()
      .int()
      .min(0, 'Age must be a non-negative integer')
      .optional(),
    gender: z.string().trim().min(1, 'Gender cannot be empty').optional(),
    phone: z.string().trim().min(1, 'Phone number cannot be empty').optional(),
    condition: z.string().trim().min(1, 'Condition cannot be empty').optional(),
    doctor: objectIdSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
