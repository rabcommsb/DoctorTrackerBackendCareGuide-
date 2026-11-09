import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/User.ts';
import { Doctor } from '../models/Doctor.ts';
import { Patient } from '../models/Patient.ts';
import { seedDatabase } from '../seed/seed.ts';

let memoryServer: MongoMemoryServer | null = null;
let connectionMode: 'external' | 'in-memory' | 'disconnected' = 'disconnected';
let activeHost = '';
let externalConnectionWarning: string | null = null;

const sanitizeHost = (uriOrHost: string): string => {
  return uriOrHost.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
};

export interface DbStatus {
  connected: boolean;
  readyState: number;
  readyStateLabel: string;
  mode: 'external' | 'in-memory' | 'disconnected';
  host: string;
  databaseName: string;
  warning?: string | null;
  collections: {
    name: string;
    documentCount: number;
    indexes: Array<{
      name: string;
      key: Record<string, unknown>;
      unique?: boolean;
      textIndexVersion?: number;
      weights?: Record<string, number>;
    }>;
  }[];
}

const READY_STATE_LABELS: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Connects to MongoDB using process.env.MONGODB_URI.
 * Automatically falls back to an embedded MongoMemoryServer instance when
 * MONGODB_URI is not configured or unreachable in the preview environment.
 */
export const connectDB = async (forceReconnect = false): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1 && !forceReconnect) {
    return mongoose;
  }

  if (forceReconnect && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  const configuredUri = process.env.MONGODB_URI?.trim();
  const isPlaceholder =
    !configuredUri ||
    configuredUri === 'MY_MONGODB_URI' ||
    configuredUri === 'mongodb://localhost:27017/doctor-tracker';

  if (!isPlaceholder && configuredUri) {
    try {
      const conn = await mongoose.connect(configuredUri, {
        dbName: 'doctor-tracker',
        serverSelectionTimeoutMS: 6000,
      });
      connectionMode = 'external';
      activeHost = sanitizeHost(conn.connection.host || 'doctortracker.bc7oooa.mongodb.net');
      externalConnectionWarning = null;
      await syncModelIndexes();
      console.log(`[db] MongoDB Atlas connected (external): ${activeHost} / db: ${conn.connection.name}`);
      return conn;
    } catch (err) {
      externalConnectionWarning = (err as Error).message;
      console.warn(
        `[db] External MONGODB_URI connection failed (${externalConnectionWarning}). Falling back to in-memory MongoDB...`
      );
    }
  } else if (configuredUri === 'mongodb://localhost:27017/doctor-tracker') {
    try {
      const conn = await mongoose.connect(configuredUri, {
        dbName: 'doctor-tracker',
        serverSelectionTimeoutMS: 1500,
      });
      connectionMode = 'external';
      activeHost = sanitizeHost(conn.connection.host);
      externalConnectionWarning = null;
      await syncModelIndexes();
      console.log(`[db] MongoDB connected (local): ${activeHost}`);
      return conn;
    } catch {
      console.log('[db] Local MongoDB not running on 27017; starting in-memory MongoDB server...');
    }
  }

  // Fallback: start MongoMemoryServer
  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'doctor-tracker',
      },
    });
  }

  const memoryUri = memoryServer.getUri('doctor-tracker');
  const conn = await mongoose.connect(memoryUri);
  connectionMode = 'in-memory';
  activeHost = '127.0.0.1 (in-memory)';

  await syncModelIndexes();
  console.log(`[db] MongoDB connected (in-memory fallback): ${conn.connection.name}`);
  return conn;
};

/**
 * Calls syncIndexes() for each Mongoose model on startup and seeds the B6 dataset
 * (1 admin user, 25 doctors, 200 patients over 60 days) if the database is empty.
 */
export const syncModelIndexes = async (): Promise<void> => {
  await Promise.all([
    User.createCollection().catch(() => undefined),
    Doctor.createCollection().catch(() => undefined),
    Patient.createCollection().catch(() => undefined),
  ]);

  await Promise.all([
    User.syncIndexes(),
    Doctor.syncIndexes(),
    Patient.syncIndexes(),
  ]);

  const [doctorCount, patientCount] = await Promise.all([
    Doctor.countDocuments(),
    Patient.countDocuments(),
  ]);

  if (doctorCount === 0 && patientCount === 0) {
    const result = await seedDatabase();
    console.log(
      `[db] Initial B6 seed provisioned: ${result.doctorsCreated} doctors, ${result.patientsCreated} patients, admin: ${result.adminEmail}`
    );
  }
};

export const getDbStatus = async (): Promise<DbStatus> => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;

  if (!connected || !mongoose.connection.db) {
    return {
      connected: false,
      readyState,
      readyStateLabel: READY_STATE_LABELS[readyState] || 'unknown',
      mode: connectionMode,
      host: 'none',
      databaseName: 'doctor-tracker',
      collections: [],
    };
  }

  const models = [
    { name: 'users', model: User },
    { name: 'doctors', model: Doctor },
    { name: 'patients', model: Patient },
  ];

  const collections = await Promise.all(
    models.map(async ({ name, model }) => {
      try {
        const [documentCount, rawIndexes] = await Promise.all([
          model.countDocuments(),
          model.collection.indexes(),
        ]);

        const indexes = rawIndexes.map((idx: Record<string, unknown>) => ({
          name: String(idx.name || ''),
          key: (idx.key as Record<string, unknown>) || {},
          ...(idx.unique ? { unique: Boolean(idx.unique) } : {}),
          ...(idx.textIndexVersion ? { textIndexVersion: Number(idx.textIndexVersion) } : {}),
          ...(idx.weights ? { weights: idx.weights as Record<string, number> } : {}),
        }));

        return {
          name,
          documentCount,
          indexes,
        };
      } catch {
        return {
          name,
          documentCount: 0,
          indexes: [],
        };
      }
    })
  );

  return {
    connected,
    readyState,
    readyStateLabel: READY_STATE_LABELS[readyState] || 'connected',
    mode: connectionMode,
    host: sanitizeHost(mongoose.connection.host || activeHost),
    databaseName: mongoose.connection.name || 'doctor-tracker',
    ...(externalConnectionWarning ? { warning: externalConnectionWarning } : {}),
    collections,
  };
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connectionMode = 'disconnected';
};

export default connectDB;
