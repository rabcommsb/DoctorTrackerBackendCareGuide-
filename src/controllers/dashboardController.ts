import { Request, Response } from 'express';
import { Doctor } from '../models/Doctor.ts';
import { Patient } from '../models/Patient.ts';
import { dashboardStatsQuerySchema } from '../validators/dashboardValidator.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

/**
 * Helper: Generates an array of YYYY-MM-DD UTC date strings for the last `days` days
 * (ending today in UTC) and fills missing dates with count = 0.
 */
const fillMissingDays = (
  rawCounts: Array<{ _id: string; count: number }>,
  days: number
): Array<{ date: string; count: number }> => {
  const countMap = new Map<string, number>();
  for (const item of rawCounts) {
    if (item._id) {
      countMap.set(item._id, item.count);
    }
  }

  const result: Array<{ date: string; count: number }> = [];
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUtc);
    d.setUTCDate(todayUtc.getUTCDate() - i);
    const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
    result.push({
      date: dateKey,
      count: countMap.get(dateKey) ?? 0,
    });
  }

  return result;
};

/**
 * Helper: Computes the Monday (start of ISO week in UTC) for a given Date
 * and formats it as YYYY-MM-DD so the last 8 weeks can be bucketed and zero-filled.
 */
const getMondayUtcKey = (date: Date): string => {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
};

const fillMissingWeeks = (
  rawWeeks: Array<{ _id: string; count: number }>,
  weeksCount = 8
): Array<{ weekStart: string; count: number }> => {
  const weekMap = new Map<string, number>();
  for (const item of rawWeeks) {
    if (item._id) {
      weekMap.set(item._id, item.count);
    }
  }

  const result: Array<{ weekStart: string; count: number }> = [];
  const now = new Date();
  const currentMonday = new Date(`${getMondayUtcKey(now)}T00:00:00.000Z`);

  for (let i = weeksCount - 1; i >= 0; i--) {
    const w = new Date(currentMonday);
    w.setUTCDate(currentMonday.getUTCDate() - i * 7);
    const weekKey = w.toISOString().slice(0, 10);
    result.push({
      weekStart: weekKey,
      count: weekMap.get(weekKey) ?? 0,
    });
  }

  return result;
};

/**
 * GET /api/dashboard/stats
 * Protected endpoint returning aggregated analytics for the clinical dashboard.
 * Accepts optional `?days=7|30|90` (default 30).
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { days } = dashboardStatsQuerySchema.parse(req.query);

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // Start boundary for `patientsOverTime` (last `days` days inclusive of today)
  const daysStartDate = new Date(todayUtc);
  daysStartDate.setUTCDate(todayUtc.getUTCDate() - (days - 1));

  // Start boundary for `doctorsOverTime` (last 8 weeks starting from the Monday 7 weeks ago)
  const currentMonday = new Date(`${getMondayUtcKey(now)}T00:00:00.000Z`);
  const eightWeeksStartDate = new Date(currentMonday);
  eightWeeksStartDate.setUTCDate(currentMonday.getUTCDate() - 7 * 7);

  // Start boundary for `newThisWeek` (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Pipeline 1: Top 10 doctors by patient count.
  // Groups patients by their `doctor` ObjectId, joins the `doctors` collection via $lookup
  // to retrieve the doctor's name and specialization, sorts descending by patient count, and limits to 10.
  const patientsPerDoctorPipeline = Patient.aggregate<{
    doctorId: string;
    name: string;
    specialization: string;
    hospital: string;
    count: number;
  }>([
    {
      $group: {
        _id: '$doctor',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
    {
      $lookup: {
        from: 'doctors',
        localField: '_id',
        foreignField: '_id',
        as: 'doctorInfo',
      },
    },
    {
      $unwind: {
        path: '$doctorInfo',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $project: {
        _id: 0,
        doctorId: { $toString: '$_id' },
        name: '$doctorInfo.name',
        specialization: '$doctorInfo.specialization',
        hospital: '$doctorInfo.hospital',
        count: 1,
      },
    },
  ]);

  // Pipeline 2: Patients created per day over the requested `days` window (7, 30, or 90 days).
  // Filters patients created since `daysStartDate` and groups by UTC calendar date (YYYY-MM-DD).
  const patientsOverTimePipeline = Patient.aggregate<{
    _id: string;
    count: number;
  }>([
    {
      $match: {
        createdAt: { $gte: daysStartDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Pipeline 3: Doctors created per week over the last 8 weeks.
  // Filters doctors created since `eightWeeksStartDate` and groups by the Monday UTC date of each creation week.
  const doctorsOverTimePipeline = Doctor.aggregate<{
    _id: string;
    count: number;
  }>([
    {
      $match: {
        createdAt: { $gte: eightWeeksStartDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $dateTrunc: {
                date: '$createdAt',
                unit: 'week',
                startOfWeek: 'monday',
                timezone: 'UTC',
              },
            },
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Pipeline 4: Patient count breakdown by medical condition.
  // Groups all patient records by `condition` and sorts descending by frequency.
  const conditionBreakdownPipeline = Patient.aggregate<{
    condition: string;
    count: number;
  }>([
    {
      $group: {
        _id: '$condition',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1, _id: 1 },
    },
    {
      $project: {
        _id: 0,
        condition: '$_id',
        count: 1,
      },
    },
  ]);

  // Pipeline 5: New doctors and new patients created in the last 7 days (`newThisWeek`).
  // Runs parallel count queries for records with `createdAt >= sevenDaysAgo`.
  const newDoctorsThisWeekPromise = Doctor.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });
  const newPatientsThisWeekPromise = Patient.countDocuments({
    createdAt: { $gte: sevenDaysAgo },
  });

  // Run all counts and MongoDB aggregation pipelines in parallel with Promise.all
  const [
    totalDoctors,
    totalPatients,
    patientsPerDoctor,
    rawPatientsOverTime,
    rawDoctorsOverTime,
    conditionBreakdown,
    newDoctorsThisWeek,
    newPatientsThisWeek,
  ] = await Promise.all([
    Doctor.countDocuments(),
    Patient.countDocuments(),
    patientsPerDoctorPipeline,
    patientsOverTimePipeline,
    doctorsOverTimePipeline,
    conditionBreakdownPipeline,
    newDoctorsThisWeekPromise,
    newPatientsThisWeekPromise,
  ]);

  const patientsOverTime = fillMissingDays(rawPatientsOverTime, days);
  const doctorsOverTime = fillMissingWeeks(rawDoctorsOverTime, 8);

  res.status(200).json({
    days,
    totalDoctors,
    totalPatients,
    patientsPerDoctor,
    patientsOverTime,
    doctorsOverTime,
    conditionBreakdown,
    newThisWeek: {
      doctors: newDoctorsThisWeek,
      patients: newPatientsThisWeek,
    },
  });
});
