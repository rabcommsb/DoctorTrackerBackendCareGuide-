import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().optional().default('3000'),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must contain at least 256 bits (32 characters) of entropy')
    .optional(),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must contain at least 256 bits (32 characters) of entropy')
    .optional(),
  JWT_EXPIRES_IN: z.string().optional().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().optional().default('7d'),
  CLIENT_URL: z.string().optional().default('http://localhost:3000'),
});

export const authCredentialsSchema = z.object({
  email: z.string().email('Valid email is required').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userValidatorSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.literal('admin').default('admin'),
});

export const doctorValidatorSchema = z.object({
  name: z.string().min(1, 'Doctor name is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  hospital: z.string().min(1, 'Hospital is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
});

export const patientValidatorSchema = z.object({
  name: z.string().min(1, 'Patient name is required'),
  age: z.number().int().min(0, 'Age must be a non-negative integer'),
  gender: z.string().min(1, 'Gender is required'),
  phone: z.string().min(1, 'Phone number is required'),
  condition: z.string().min(1, 'Condition is required'),
  doctor: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Valid Doctor ObjectId is required'),
});
