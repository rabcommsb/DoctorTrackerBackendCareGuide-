import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { hashPassword } from '../utils/auth';

type PatientGender = 'Male' | 'Female' | 'Other';

const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Oncology',
  'Orthopedics',
  'Pediatrics',
  'Endocrinology',
  'Pulmonology',
  'Gastroenterology',
  'Nephrology',
  'Dermatology',
];

const HOSPITALS = [
  'Metropolitan Heart Institute',
  'St. Jude Clinical Center',
  'Pacific Regional Hospital',
  'Mount Sinai Medical Pavilion',
  'University Health System',
  'Cedars Clinical Research Hospital',
  'Northwestern Memorial Center',
  'Baylor Specialty Clinic',
];

const DOCTOR_PROFILES = [
  { name: 'Dr. Elena Vance', specialization: 'Cardiology', hospital: 'Metropolitan Heart Institute' },
  { name: 'Dr. Marcus Thorne', specialization: 'Neurology', hospital: 'St. Jude Clinical Center' },
  { name: 'Dr. Priya Nair', specialization: 'Oncology', hospital: 'Pacific Regional Hospital' },
  { name: 'Dr. Julian Mercer', specialization: 'Orthopedics', hospital: 'Mount Sinai Medical Pavilion' },
  { name: 'Dr. Hannah Lindqvist', specialization: 'Pediatrics', hospital: 'University Health System' },
  { name: 'Dr. Mateo Alvarez', specialization: 'Endocrinology', hospital: 'Cedars Clinical Research Hospital' },
  { name: 'Dr. Sophia Chen', specialization: 'Pulmonology', hospital: 'Northwestern Memorial Center' },
  { name: 'Dr. David Osei', specialization: 'Gastroenterology', hospital: 'Baylor Specialty Clinic' },
  { name: 'Dr. Amara Koury', specialization: 'Nephrology', hospital: 'Metropolitan Heart Institute' },
  { name: 'Dr. Liam Gallagher', specialization: 'Dermatology', hospital: 'St. Jude Clinical Center' },
  { name: 'Dr. Nadia Rostova', specialization: 'Cardiology', hospital: 'Pacific Regional Hospital' },
  { name: 'Dr. Benjamin Cho', specialization: 'Neurology', hospital: 'Mount Sinai Medical Pavilion' },
  { name: 'Dr. Claire Beaumont', specialization: 'Oncology', hospital: 'University Health System' },
  { name: 'Dr. Omar Farooq', specialization: 'Orthopedics', hospital: 'Cedars Clinical Research Hospital' },
  { name: 'Dr. Rachel Sterling', specialization: 'Pediatrics', hospital: 'Northwestern Memorial Center' },
  { name: 'Dr. Victor Kovic', specialization: 'Endocrinology', hospital: 'Baylor Specialty Clinic' },
  { name: 'Dr. Mei-Ling Zhou', specialization: 'Pulmonology', hospital: 'Metropolitan Heart Institute' },
  { name: 'Dr. Sebastian Morales', specialization: 'Gastroenterology', hospital: 'St. Jude Clinical Center' },
  { name: 'Dr. Aisha Patel', specialization: 'Nephrology', hospital: 'Pacific Regional Hospital' },
  { name: 'Dr. Henrik Lindholm', specialization: 'Dermatology', hospital: 'Mount Sinai Medical Pavilion' },
  { name: 'Dr. Gabriela Santos', specialization: 'Cardiology', hospital: 'University Health System' },
  { name: 'Dr. Tariq Al-Mansoor', specialization: 'Neurology', hospital: 'Cedars Clinical Research Hospital' },
  { name: 'Dr. Fiona MacLeod', specialization: 'Oncology', hospital: 'Northwestern Memorial Center' },
  { name: 'Dr. Kenji Takahashi', specialization: 'Orthopedics', hospital: 'Baylor Specialty Clinic' },
  { name: 'Dr. Simone Laurent', specialization: 'Endocrinology', hospital: 'Metropolitan Heart Institute' },
];

const PATIENT_FIRST_NAMES = [
  'Arthur', 'Clara', 'Samuel', 'Evelyn', 'Lucas', 'Maya', 'Gabriel', 'Nora',
  'Isaac', 'Zoe', 'Caleb', 'Hannah', 'Nathan', 'Audrey', 'Leo', 'Claire',
  'Adrian', 'Stella', 'Julian', 'Hazel', 'Miles', 'Violet', 'Eli', 'Aurora',
  'Landon', 'Savannah', 'Jonathan', 'Bella', 'Nolan', 'Skylar', 'Roman', 'Lucy',
  'Xavier', 'Paisley', 'dominic', 'Everly', 'Jaxon', 'Anna', 'Greyson', 'Caroline',
];

const PATIENT_LAST_NAMES = [
  'Pendelton', 'Lin', 'Okafor', 'Kowalski', 'Vargas', 'Subramanian', 'Moreau', 'bergstrom',
  'Nakamura', 'Haddad', 'Delgado', 'Fitzgerald', 'novak', 'Chauhan', 'Svensson', 'Mendoza',
  'Almeida', 'Bianchi', 'Reyes', 'kim', 'lindner', 'Petrov', 'Castillo', 'Bouchard',
  'Mensah', 'Walsh', 'Santoro', 'yoon', 'Gallagher', 'Zimmerman',
];

const CONDITIONS = [
  'Hypertension Stage 2',
  'Atrial Fibrillation',
  'Type 2 Diabetes Mellitus',
  'Chronic Migraine',
  'Asthma Exacerbation',
  'Coronary Artery Disease',
  'Osteoarthritis',
  'Gastroesophageal Reflux Disease',
  'Chronic Kidney Disease Stage 3',
  'Iron Deficiency Anemia',
  'Hypothyroidism',
  'Community-Acquired Pneumonia',
];

const GENDERS: PatientGender[] = ['Male', 'Female', 'Other'];

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Generates a deterministic pseudo-random date within the last `maxDaysAgo` days (default 60 days).
 */
const randomDateWithinLastDays = (maxDaysAgo = 60, seedIndex = 0): Date => {
  const now = Date.now();
  // Mix random and evenly spread offsets so every day/week over the 60-day window has realistic coverage
  const randomFraction = (Math.sin(seedIndex * 9301 + 49297) * 0.5 + 0.5 + Math.random()) / 2;
  const msOffset = Math.floor(randomFraction * maxDaysAgo * 24 * 60 * 60 * 1000);
  return new Date(now - msOffset);
};

export interface SeedResult {
  adminEmail: string;
  doctorsCreated: number;
  patientsCreated: number;
  specializationsCount: number;
  hospitalsCount: number;
  conditionsCount: number;
}

/**
 * Clears User, Doctor, and Patient collections, synchronizes all model indexes,
 * and seeds:
 * - 1 Admin user (`admin@doctortracker.com` / `Admin@12345`)
 * - 25 Doctors with realistic specializations and hospitals (createdAt spread over last 60 days)
 * - 200 Patients with varied conditions across those 25 doctors (createdAt spread over last 60 days)
 */
export const seedDatabase = async (): Promise<SeedResult> => {
  // Ensure collections exist and clear existing documents
  await Promise.all([
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    User.deleteMany({}),
  ]);

  // Synchronize all Mongoose indexes
  await Promise.all([
    User.syncIndexes(),
    Doctor.syncIndexes(),
    Patient.syncIndexes(),
  ]);

  // 1. Create Admin user (admin@doctortracker.com / Admin@12345)
  const adminEmail = 'admin@doctortracker.com';
  const adminPasswordHash = await hashPassword('Admin@12345');

  await User.create({
    email: adminEmail,
    passwordHash: adminPasswordHash,
    role: 'admin',
  });

  // 2. Create 25 Doctors with realistic specializations, hospitals, and createdAt over last 60 days
  const doctorDocs = DOCTOR_PROFILES.slice(0, 25).map((profile, idx) => {
    const createdAt = randomDateWithinLastDays(60, idx + 1);
    const slug = profile.name
      .replace(/^Dr\.\s+/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.');
    const domain = profile.hospital
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 16);

    return {
      _id: new Types.ObjectId(),
      name: profile.name,
      specialization: profile.specialization || SPECIALIZATIONS[idx % SPECIALIZATIONS.length],
      hospital: profile.hospital || HOSPITALS[idx % HOSPITALS.length],
      phone: `+1-555-${String(1010 + idx * 17).padStart(4, '0')}`,
      email: `${slug}@${domain}.org`,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Doctor.collection.insertMany(doctorDocs);

  // 3. Create 200 Patients with varied conditions and createdAt spread over the last 60 days
  // Use a weighted doctor assignment so top-10 doctors have varied patient counts in dashboard analytics
  const patientDocs = Array.from({ length: 200 }, (_, idx) => {
    const firstName = capitalize(
      PATIENT_FIRST_NAMES[idx % PATIENT_FIRST_NAMES.length]
    );
    const lastName = capitalize(
      PATIENT_LAST_NAMES[(idx * 7 + 3) % PATIENT_LAST_NAMES.length]
    );

    // Weighted distribution across the 25 doctors
    const doctorIndex =
      idx < 120
        ? (idx * 3) % 12 // Higher concentration among first 12 doctors for clear top-10 chart ranking
        : idx % doctorDocs.length;

    const assignedDoctor = doctorDocs[doctorIndex];
    const condition = CONDITIONS[(idx * 5 + doctorIndex) % CONDITIONS.length];
    const gender = GENDERS[idx % 7 === 0 ? 2 : idx % 2];
    const age = 19 + ((idx * 13 + 7) % 69); // Ages 19..87
    const createdAt = randomDateWithinLastDays(60, idx + 100);

    return {
      _id: new Types.ObjectId(),
      name: `${firstName} ${lastName}`,
      age,
      gender,
      phone: `+1-555-${String(3000 + idx * 19).padStart(4, '0')}`,
      condition,
      doctor: assignedDoctor._id,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Patient.collection.insertMany(patientDocs);

  return {
    adminEmail,
    doctorsCreated: doctorDocs.length,
    patientsCreated: patientDocs.length,
    specializationsCount: new Set(doctorDocs.map((d) => d.specialization)).size,
    hospitalsCount: new Set(doctorDocs.map((d) => d.hospital)).size,
    conditionsCount: new Set(patientDocs.map((p) => p.condition)).size,
  };
};

/**
 * Standalone CLI runner (`npm run seed` or `tsx src/seed/seed.ts`)
 */
export const runCliSeed = async (): Promise<void> => {
  const { connectDB, disconnectDB } = await import('../config/db');
  try {
    console.log('[seed] Connecting to MongoDB...');
    await connectDB();

    console.log('[seed] Clearing collections and seeding B6 dataset...');
    const result = await seedDatabase();

    console.log('[seed] Seed completed successfully:');
    console.log(`  - Admin User : ${result.adminEmail} / Admin@12345`);
    console.log(`  - Doctors    : ${result.doctorsCreated} (${result.specializationsCount} specializations, ${result.hospitalsCount} hospitals)`);
    console.log(`  - Patients   : ${result.patientsCreated} (${result.conditionsCount} conditions, spread over last 60 days)`);
  } catch (err) {
    console.error('[seed] Failed to seed database:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectDB();
    }
  }
};

const currentFile = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') ||
    process.argv[1].endsWith('seed/index.ts') ||
    process.argv[1] === currentFile)
) {
  runCliSeed();
}
