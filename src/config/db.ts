import mongoose from 'mongoose';
import { User } from '../models/User';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';

interface MongooseGlobalCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  mode: 'external' | 'in-memory' | 'disconnected';
  host: string;
  warning: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseGlobalCache | undefined;
}

const cached: MongooseGlobalCache =
  globalThis.__mongooseCache ??
  (globalThis.__mongooseCache = {
    conn: null,
    promise: null,
    mode: 'disconnected',
    host: '',
    warning: null,
  });

const sanitizeHost = (uriOrHost: string): string => {
  return uriOrHost.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
};

/**
 * Normalizes and validates a MongoDB connection string from process.env.MONGODB_URI.
 */
const normalizeMongoUri = (raw?: string): string | null => {
  if (!raw) return null;

  let cleaned = raw.trim();
  if (cleaned.startsWith('MONGODB_URI=')) {
    cleaned = cleaned.slice('MONGODB_URI='.length).trim();
  }
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (
    !cleaned ||
    cleaned === 'MY_MONGODB_URI' ||
    cleaned.includes('<username>') ||
    cleaned.includes('<password>') ||
    (!cleaned.startsWith('mongodb://') && !cleaned.startsWith('mongodb+srv://'))
  ) {
    return null;
  }

  return cleaned;
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

const establishConnection = async (): Promise<typeof mongoose> => {
  const validUri = normalizeMongoUri(process.env.MONGODB_URI);

  if (validUri) {
    try {
      const conn = await mongoose.connect(validUri, {
        dbName: 'doctor-tracker',
        serverSelectionTimeoutMS: 5000,
      });
      cached.mode = 'external';
      cached.host = sanitizeHost(conn.connection.host || 'mongodb-atlas');
      cached.warning = null;
      console.log(
        `[db] MongoDB connected (external): ${cached.host} / db: ${conn.connection.name}`
      );
      return conn;
    } catch (err) {
      cached.warning = (err as Error).message;
      if (process.env.VERCEL) {
        throw new Error(`[db] Cannot connect to MongoDB Atlas (check MONGODB_URI): ${cached.warning}`);
      }
      console.log(
        `[db] External MONGODB_URI unreachable (${cached.warning}). Falling back to local in-memory MongoDB.`
      );
    }
  } else if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('[db] Invalid or missing MONGODB_URI in production environment.');
  }

  // Local dev fallback: dynamically import MongoMemoryServer only when needed
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'doctor-tracker',
    },
  });

  const memoryUri = memoryServer.getUri('doctor-tracker');
  const conn = await mongoose.connect(memoryUri);
  cached.mode = 'in-memory';
  cached.host = '127.0.0.1 (in-memory)';
  console.log(`[db] MongoDB connected (in-memory): ${conn.connection.name}`);
  return conn;
};

/**
 * Connects to MongoDB and caches the connection and pending promise on `globalThis.__mongooseCache`.
 */
export const connectDB = async (
  forceReconnect = false
): Promise<typeof mongoose> => {
  if (forceReconnect && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = establishConnection().catch((err) => {
      cached.promise = null;
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export const getDbStatus = async (): Promise<DbStatus> => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;

  if (!connected || !mongoose.connection.db) {
    return {
      connected: false,
      readyState,
      readyStateLabel: READY_STATE_LABELS[readyState] || 'unknown',
      mode: cached.mode,
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
          ...(idx.textIndexVersion
            ? { textIndexVersion: Number(idx.textIndexVersion) }
            : {}),
          ...(idx.weights
            ? { weights: idx.weights as Record<string, number> }
            : {}),
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
    mode: cached.mode,
    host: sanitizeHost(mongoose.connection.host || cached.host),
    databaseName: mongoose.connection.name || 'doctor-tracker',
    ...(cached.warning ? { warning: cached.warning } : {}),
    collections,
  };
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  cached.conn = null;
  cached.promise = null;
  cached.mode = 'disconnected';
};

export default connectDB;
