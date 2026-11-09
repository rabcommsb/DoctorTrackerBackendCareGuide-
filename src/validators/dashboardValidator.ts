import { z } from 'zod';

export const dashboardStatsQuerySchema = z.object({
  days: z
    .string()
    .trim()
    .optional()
    .default('30')
    .transform((val) => Number(val))
    .refine((val): val is 7 | 30 | 90 => val === 7 || val === 30 || val === 90, {
      message: 'Query param "days" must be one of 7, 30, or 90',
    }),
});
