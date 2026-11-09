/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  Copy,
  Database,
  Edit3,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCheck,
  Users,
  AlertCircle,
} from 'lucide-react';

interface DbIndexInfo {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  textIndexVersion?: number;
  weights?: Record<string, number>;
}

interface DbCollectionInfo {
  name: string;
  documentCount: number;
  indexes: DbIndexInfo[];
}

interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: {
    nodeEnv: string;
    port: number;
    clientUrl: string;
    jwtConfigured: boolean;
    jwtSecretSource?: string;
    jwtAllowedAlgorithms?: string[];
    jwtExpiresIn: string;
    jwtRefreshExpiresIn?: string;
    cookiePolicy?: string;
  };
  database: {
    connected: boolean;
    readyState: number;
    readyStateLabel: string;
    mode: 'external' | 'in-memory' | 'disconnected';
    host: string;
    databaseName: string;
    warning?: string | null;
    collections: DbCollectionInfo[];
  };
}

interface DoctorRecord {
  _id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface PopulatedDoctorRef {
  _id: string;
  name: string;
  specialization: string;
}

interface PatientRecord {
  _id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  condition: string;
  doctor: string | PopulatedDoctorRef;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DashboardStatsResponse {
  days: 7 | 30 | 90;
  totalDoctors: number;
  totalPatients: number;
  patientsPerDoctor: Array<{
    doctorId: string;
    name: string;
    specialization: string;
    hospital: string;
    count: number;
  }>;
  patientsOverTime: Array<{
    date: string;
    count: number;
  }>;
  doctorsOverTime: Array<{
    weekStart: string;
    count: number;
  }>;
  conditionBreakdown: Array<{
    condition: string;
    count: number;
  }>;
  newThisWeek: {
    doctors: number;
    patients: number;
  };
}

interface SchemaFieldSpec {
  field: string;
  type: string;
  required: boolean;
  constraints: string;
  description: string;
}

interface ModelSpec {
  id: 'User' | 'Doctor' | 'Patient';
  collectionName: 'users' | 'doctors' | 'patients';
  filePath: string;
  summary: string;
  timestamps: boolean;
  fields: SchemaFieldSpec[];
  declaredIndexes: {
    name: string;
    kind: string;
    definition: string;
    purpose: string;
  }[];
}

const MODEL_SPECS: ModelSpec[] = [
  {
    id: 'User',
    collectionName: 'users',
    filePath: 'src/models/User.ts',
    summary: 'System administrator credentials and role-based access identity.',
    timestamps: true,
    fields: [
      {
        field: 'email',
        type: 'String',
        required: true,
        constraints: 'unique · lowercase · trim',
        description: 'Unique administrator login email address',
      },
      {
        field: 'passwordHash',
        type: 'String',
        required: true,
        constraints: 'bcryptjs hash (12 rounds)',
        description: 'Salted bcrypt password digest',
      },
      {
        field: 'role',
        type: 'String',
        required: true,
        constraints: 'enum: ["admin"] · default: "admin"',
        description: 'Access control role for administrative operations',
      },
      {
        field: 'createdAt / updatedAt',
        type: 'Date',
        required: true,
        constraints: 'timestamps: true',
        description: 'Automatic Mongoose document audit timestamps',
      },
    ],
    declaredIndexes: [
      {
        name: 'email_1',
        kind: 'Unique Single-Field',
        definition: '{ email: 1 } (unique: true)',
        purpose: 'Enforces unique administrator email lookup',
      },
    ],
  },
  {
    id: 'Doctor',
    collectionName: 'doctors',
    filePath: 'src/models/Doctor.ts',
    summary: 'Clinical practitioner directory with specialization and hospital placement.',
    timestamps: true,
    fields: [
      {
        field: 'name',
        type: 'String',
        required: true,
        constraints: 'trim · text indexed',
        description: 'Full legal and clinical title of the physician',
      },
      {
        field: 'specialization',
        type: 'String',
        required: true,
        constraints: 'trim · compound indexed',
        description: 'Primary medical specialty (e.g., Cardiology, Neurology)',
      },
      {
        field: 'hospital',
        type: 'String',
        required: true,
        constraints: 'trim · text & single indexed',
        description: 'Assigned medical center or hospital facility',
      },
      {
        field: 'phone',
        type: 'String',
        required: true,
        constraints: 'trim',
        description: 'Direct clinical contact phone number',
      },
      {
        field: 'email',
        type: 'String',
        required: true,
        constraints: 'unique · lowercase · trim · text indexed',
        description: 'Unique physician contact email address',
      },
      {
        field: 'createdAt / updatedAt',
        type: 'Date',
        required: true,
        constraints: 'timestamps: true',
        description: 'Automatic Mongoose document audit timestamps',
      },
    ],
    declaredIndexes: [
      {
        name: 'doctor_text_idx',
        kind: 'Full-Text Index',
        definition: '{ name: "text", email: "text", hospital: "text" }',
        purpose: 'Full-text search across doctor name, email, and hospital',
      },
      {
        name: 'specialization_createdAt_idx',
        kind: 'Compound Index',
        definition: '{ specialization: 1, createdAt: -1 }',
        purpose: 'Filters by specialization sorted newest-first',
      },
      {
        name: 'hospital_idx',
        kind: 'Single-Field Index',
        definition: '{ hospital: 1 }',
        purpose: 'High-speed lookup by hospital facility',
      },
      {
        name: 'email_1',
        kind: 'Unique Single-Field',
        definition: '{ email: 1 } (unique: true)',
        purpose: 'Prevents duplicate doctor email registrations',
      },
    ],
  },
  {
    id: 'Patient',
    collectionName: 'patients',
    filePath: 'src/models/Patient.ts',
    summary: 'Patient medical records linked to an assigned Doctor via ObjectId reference.',
    timestamps: true,
    fields: [
      {
        field: 'name',
        type: 'String',
        required: true,
        constraints: 'trim · text indexed',
        description: 'Full name of the registered patient',
      },
      {
        field: 'age',
        type: 'Number',
        required: true,
        constraints: 'min: 0',
        description: 'Patient age in years',
      },
      {
        field: 'gender',
        type: 'String',
        required: true,
        constraints: 'trim',
        description: 'Patient gender identifier',
      },
      {
        field: 'phone',
        type: 'String',
        required: true,
        constraints: 'trim · text indexed',
        description: 'Patient contact phone number',
      },
      {
        field: 'condition',
        type: 'String',
        required: true,
        constraints: 'trim · compound indexed',
        description: 'Primary clinical diagnosis or medical condition',
      },
      {
        field: 'doctor',
        type: 'ObjectId',
        required: true,
        constraints: 'ref: "Doctor" · required · compound indexed',
        description: 'Foreign key reference to assigned Doctor document',
      },
      {
        field: 'createdAt / updatedAt',
        type: 'Date',
        required: true,
        constraints: 'timestamps: true',
        description: 'Automatic Mongoose document audit timestamps',
      },
    ],
    declaredIndexes: [
      {
        name: 'patient_text_idx',
        kind: 'Full-Text Index',
        definition: '{ name: "text", phone: "text" }',
        purpose: 'Full-text search across patient name and phone number',
      },
      {
        name: 'doctor_createdAt_idx',
        kind: 'Compound Index',
        definition: '{ doctor: 1, createdAt: -1 }',
        purpose: 'Lists patients per doctor ordered by most recent admission',
      },
      {
        name: 'condition_createdAt_idx',
        kind: 'Compound Index',
        definition: '{ condition: 1, createdAt: -1 }',
        purpose: 'Filters patients by medical condition ordered newest-first',
      },
    ],
  },
];

const ARCHITECTURE_MODULES = [
  { folder: 'src/config', file: 'db.ts', role: 'Mongoose connection manager with MONGODB_URI and index synchronization' },
  { folder: 'src/models', file: 'User.ts · Doctor.ts · Patient.ts', role: 'Typed Mongoose schemas with text and compound index definitions' },
  { folder: 'src/controllers', file: 'dashboardController.ts · doctorController.ts · patientController.ts · authController.ts', role: 'B5 Aggregation stats, B3 Doctor CRUD, B4 Patient CRUD, B2 Auth, B1 Health' },
  { folder: 'src/routes', file: 'dashboardRoutes.ts · doctorRoutes.ts · patientRoutes.ts · authRoutes.ts', role: 'Protected /api/dashboard/stats, /api/doctors, /api/patients, /api/auth/login' },
  { folder: 'src/middleware', file: 'auth.ts · errorHandler.ts', role: 'Bearer JWT verifier, requireRole("admin"), notFound, and central errorHandler (400/409/500)' },
  { folder: 'src/validators', file: 'dashboardValidator.ts · doctorValidator.ts · patientValidator.ts · authValidator.ts', role: 'Zod validation schemas for body, partial PATCH, query params, and ObjectIds' },
  { folder: 'src/utils', file: 'asyncHandler.ts · queryHelpers.ts · auth.ts · generateSecret.ts', role: 'asyncHandler wrapper, shared pagination & date-range helpers, HS256 JWT signer' },
  { folder: 'src/seed', file: 'seed.ts · index.ts', role: 'B6 seed runner: clears DB, seeds admin + 25 doctors + 200 patients over last 60 days' },
];

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<'ALL' | 'User' | 'Doctor' | 'Patient'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // B2 Interactive Auth Console State
  const [loginEmail, setLoginEmail] = useState<string>('admin@doctortracker.com');
  const [loginPassword, setLoginPassword] = useState<string>('Admin@12345');
  const [authToken, setAuthToken] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [authEndpointLabel, setAuthEndpointLabel] = useState<string>('POST /api/auth/login');
  const [authResponsePayload, setAuthResponsePayload] = useState<Record<string, unknown> | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<string>('--');
  const [rateLimitLimit, setRateLimitLimit] = useState<string>('10');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // B3 Doctor Management Console State
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [doctorPagination, setDoctorPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [filterOptions, setFilterOptions] = useState<{
    specializations: string[];
    hospitals: string[];
  }>({ specializations: [], hospitals: [] });
  const [docSearch, setDocSearch] = useState<string>('');
  const [docSpecialization, setDocSpecialization] = useState<string>('');
  const [docHospital, setDocHospital] = useState<string>('');
  const [docLoading, setDocLoading] = useState<boolean>(false);

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);
  const [doctorPatients, setDoctorPatients] = useState<PatientRecord[]>([]);
  const [patientPagination, setPatientPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [patientSearch, setPatientSearch] = useState<string>('');

  // Create Doctor Form State
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocSpec, setNewDocSpec] = useState<string>('');
  const [newDocHosp, setNewDocHosp] = useState<string>('');
  const [newDocPhone, setNewDocPhone] = useState<string>('');
  const [newDocEmail, setNewDocEmail] = useState<string>('');
  const [b3Message, setB3Message] = useState<string | null>(null);

  // Create Patient Form State
  const [newPatName, setNewPatName] = useState<string>('');
  const [newPatAge, setNewPatAge] = useState<string>('45');
  const [newPatGender, setNewPatGender] = useState<string>('Female');
  const [newPatPhone, setNewPatPhone] = useState<string>('');
  const [newPatCondition, setNewPatCondition] = useState<string>('');

  // B4 Global Patient Directory (/api/patients) State
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [allPatientsPagination, setAllPatientsPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [b4Search, setB4Search] = useState<string>('');
  const [b4Condition, setB4Condition] = useState<string>('');
  const [b4DoctorFilter, setB4DoctorFilter] = useState<string>('');
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editingCondition, setEditingCondition] = useState<string>('');
  const [b4Message, setB4Message] = useState<string | null>(null);

  // B5 Dashboard Analytics (/api/dashboard/stats) State
  const [dashboardDays, setDashboardDays] = useState<7 | 30 | 90>(30);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);

  const pingHealthEndpoint = useCallback(async (reconnectAtlas = false) => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const url = reconnectAtlas ? '/api/health?reconnect=true' : '/api/health';
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setHttpStatus(response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch /api/health`);
      }

      const data: HealthResponse = await response.json();
      setHealth(data);
    } catch (err) {
      setError((err as Error).message || 'Unable to reach /api/health');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchB5DashboardStats = useCallback(
    async (tokenOverride?: string, daysVal: 7 | 30 | 90 = dashboardDays) => {
      const tokenToUse = tokenOverride ?? authToken;
      if (!tokenToUse) return;
      setDashboardLoading(true);
      try {
        const res = await fetch(`/api/dashboard/stats?days=${daysVal}`, {
          headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data: DashboardStatsResponse = await res.json();
          setDashboardStats(data);
        }
      } finally {
        setDashboardLoading(false);
      }
    },
    [authToken, dashboardDays]
  );

  const fetchB4PatientsAndOptions = useCallback(
    async (
      tokenOverride?: string,
      searchVal = b4Search,
      condVal = b4Condition,
      docIdVal = b4DoctorFilter
    ) => {
      const tokenToUse = tokenOverride ?? authToken;
      if (!tokenToUse) return;
      const params = new URLSearchParams();
      if (searchVal.trim()) params.set('search', searchVal.trim());
      if (condVal) params.set('condition', condVal);
      if (docIdVal) params.set('doctor', docIdVal);
      params.set('page', '1');
      params.set('limit', '10');

      const [patsRes, condsRes] = await Promise.all([
        fetch(`/api/patients?${params.toString()}`, {
          headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
        }),
        fetch('/api/patients/filters/options', {
          headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
        }),
      ]);

      if (patsRes.ok) {
        const patsJson = await patsRes.json();
        setAllPatients(patsJson.data || []);
        if (patsJson.pagination) setAllPatientsPagination(patsJson.pagination);
      }

      if (condsRes.ok) {
        const condsJson = await condsRes.json();
        setConditionOptions(condsJson.conditions || []);
      }
    },
    [authToken, b4Search, b4Condition, b4DoctorFilter]
  );

  const fetchB3DoctorsAndOptions = useCallback(
    async (tokenOverride?: string, searchVal = docSearch, specVal = docSpecialization, hospVal = docHospital) => {
      const tokenToUse = tokenOverride ?? authToken;
      if (!tokenToUse) return;
      setDocLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchVal.trim()) params.set('search', searchVal.trim());
        if (specVal) params.set('specialization', specVal);
        if (hospVal) params.set('hospital', hospVal);
        params.set('page', '1');
        params.set('limit', '10');

        const [docsRes, optsRes] = await Promise.all([
          fetch(`/api/doctors?${params.toString()}`, {
            headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
          }),
          fetch('/api/doctors/filters/options', {
            headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
          }),
        ]);

        if (docsRes.ok) {
          const docsJson = await docsRes.json();
          const list: DoctorRecord[] = docsJson.data || [];
          setDoctors(list);
          if (docsJson.pagination) setDoctorPagination(docsJson.pagination);
          if (list.length > 0 && !selectedDoctor) {
            setSelectedDoctor(list[0]);
          }
        }

        if (optsRes.ok) {
          const optsJson = await optsRes.json();
          setFilterOptions({
            specializations: optsJson.specializations || [],
            hospitals: optsJson.hospitals || [],
          });
        }
      } finally {
        setDocLoading(false);
      }
    },
    [authToken, docSearch, docSpecialization, docHospital, selectedDoctor]
  );

  const fetchPatientsForDoctor = useCallback(
    async (doctorId: string, tokenOverride?: string, patSearchVal = patientSearch) => {
      const tokenToUse = tokenOverride ?? authToken;
      if (!tokenToUse || !doctorId) return;
      const params = new URLSearchParams();
      if (patSearchVal.trim()) params.set('search', patSearchVal.trim());
      params.set('page', '1');
      params.set('limit', '10');

      const res = await fetch(`/api/doctors/${doctorId}/patients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${tokenToUse}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        setDoctorPatients(json.data || []);
        if (json.pagination) setPatientPagination(json.pagination);
      }
    },
    [authToken, patientSearch]
  );

  const handleTestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthEndpointLabel('POST /api/auth/login');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const remaining = response.headers.get('ratelimit-remaining');
      const limit = response.headers.get('ratelimit-limit');
      if (remaining !== null) setRateLimitRemaining(remaining);
      if (limit !== null) setRateLimitLimit(limit);

      setAuthStatus(response.status);
      const data = await response.json();
      setAuthResponsePayload(data);

      if (response.ok && typeof data.token === 'string') {
        setAuthToken(data.token);
        await Promise.all([
          fetchB3DoctorsAndOptions(data.token),
          fetchB4PatientsAndOptions(data.token),
          fetchB5DashboardStats(data.token, dashboardDays),
        ]);
      }
    } catch (err) {
      setAuthStatus(500);
      setAuthResponsePayload({
        status: 'error',
        message: (err as Error).message || 'Login request failed',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTestGetMe = async (useBearerToken = true) => {
    setAuthLoading(true);
    setAuthEndpointLabel(
      useBearerToken ? 'GET /api/auth/me (with Bearer JWT)' : 'GET /api/auth/me (no token)'
    );
    try {
      if (!useBearerToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        }).catch(() => undefined);
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (useBearerToken && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers,
        credentials: useBearerToken ? 'same-origin' : 'omit',
      });

      setAuthStatus(response.status);
      const data = await response.json();
      setAuthResponsePayload(data);
    } catch (err) {
      setAuthStatus(500);
      setAuthResponsePayload({
        status: 'error',
        message: (err as Error).message || 'GET /api/auth/me failed',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) {
      setB3Message('Authenticate via B2 Login first to obtain a Bearer token.');
      return;
    }
    setB3Message(null);
    const res = await fetch('/api/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: newDocName,
        specialization: newDocSpec,
        hospital: newDocHosp,
        phone: newDocPhone,
        email: newDocEmail,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setB3Message(`HTTP ${res.status}: ${data.message || 'Failed to create doctor'}`);
      return;
    }
    setNewDocName('');
    setNewDocSpec('');
    setNewDocHosp('');
    setNewDocPhone('');
    setNewDocEmail('');
    setB3Message(`Created doctor ${data.data?.name} (201 Created)`);
    await Promise.all([
      fetchB3DoctorsAndOptions(),
      fetchB5DashboardStats(),
      pingHealthEndpoint(false),
    ]);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !selectedDoctor) return;
    setB3Message(null);
    const res = await fetch(`/api/doctors/${selectedDoctor._id}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: newPatName,
        age: Number(newPatAge),
        gender: newPatGender,
        phone: newPatPhone,
        condition: newPatCondition,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setB3Message(`HTTP ${res.status}: ${data.message || 'Failed to add patient'}`);
      return;
    }
    setNewPatName('');
    setNewPatPhone('');
    setNewPatCondition('');
    setB3Message(`Added patient ${data.data?.name} under ${selectedDoctor.name}`);
    await Promise.all([
      fetchPatientsForDoctor(selectedDoctor._id),
      fetchB4PatientsAndOptions(),
      fetchB5DashboardStats(),
      pingHealthEndpoint(false),
    ]);
  };

  const handleDeleteDoctorPatient = async (patientId: string) => {
    if (!authToken || !selectedDoctor) return;
    const res = await fetch(`/api/doctors/${selectedDoctor._id}/patients/${patientId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setB3Message('Patient deleted via /api/doctors/:id/patients/:patientId (200 OK)');
      await Promise.all([
        fetchPatientsForDoctor(selectedDoctor._id),
        fetchB4PatientsAndOptions(),
        fetchB5DashboardStats(),
        pingHealthEndpoint(false),
      ]);
    }
  };

  const handlePatchPatient = async (patientId: string) => {
    if (!authToken || !editingCondition.trim()) return;
    const res = await fetch(`/api/patients/${patientId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ condition: editingCondition.trim() }),
    });
    if (res.ok) {
      setEditingPatientId(null);
      setB4Message('Updated patient via PATCH /api/patients/:id (200 OK)');
      await Promise.all([
        fetchB4PatientsAndOptions(),
        fetchB5DashboardStats(),
        selectedDoctor ? fetchPatientsForDoctor(selectedDoctor._id) : Promise.resolve(),
      ]);
    }
  };

  const handleDeletePatientDirect = async (patientId: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/patients/${patientId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      setB4Message('Deleted patient via DELETE /api/patients/:id (200 OK)');
      await Promise.all([
        fetchB4PatientsAndOptions(),
        fetchB5DashboardStats(),
        selectedDoctor ? fetchPatientsForDoctor(selectedDoctor._id) : Promise.resolve(),
        pingHealthEndpoint(false),
      ]);
    }
  };

  const handleRunB6Seed = async () => {
    if (!authToken) return;
    setDashboardLoading(true);
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        await Promise.all([
          fetchB3DoctorsAndOptions(authToken),
          fetchB4PatientsAndOptions(authToken),
          fetchB5DashboardStats(authToken, dashboardDays),
          pingHealthEndpoint(false),
        ]);
      }
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    pingHealthEndpoint();
  }, [pingHealthEndpoint]);

  useEffect(() => {
    if (selectedDoctor && authToken) {
      fetchPatientsForDoctor(selectedDoctor._id, authToken, patientSearch);
    }
  }, [selectedDoctor, authToken, patientSearch, fetchPatientsForDoctor]);

  const handleCopyJson = async () => {
    if (!health) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(health, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MODEL_SPECS.filter((m) => {
      if (selectedModel !== 'ALL' && m.id !== selectedModel) return false;
      if (!query) return true;
      const matchesModel =
        m.id.toLowerCase().includes(query) ||
        m.summary.toLowerCase().includes(query) ||
        m.filePath.toLowerCase().includes(query);
      const matchesFields = m.fields.some(
        (f) =>
          f.field.toLowerCase().includes(query) ||
          f.type.toLowerCase().includes(query) ||
          f.constraints.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query)
      );
      const matchesIndexes = m.declaredIndexes.some(
        (idx) =>
          idx.name.toLowerCase().includes(query) ||
          idx.definition.toLowerCase().includes(query) ||
          idx.purpose.toLowerCase().includes(query)
      );
      return matchesModel || matchesFields || matchesIndexes;
    });
  }, [selectedModel, searchQuery]);

  const totalLiveIndexes = useMemo(() => {
    if (!health?.database?.collections) return 0;
    return health.database.collections.reduce(
      (acc, col) => acc + col.indexes.length,
      0
    );
  }, [health]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title (Single text element) */}
          <a
            href="#overview"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            doctor-tracker-api
          </a>

          {/* Zone 2: 5 Single-line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#auth-console"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              B2 Auth
            </a>
            <a
              href="#b3-doctors"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              B3 Doctors
            </a>
            <a
              href="#b4-patients"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              B4 Patients
            </a>
            <a
              href="#b5-dashboard"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              B5 Analytics
            </a>
            <a
              href="#models"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Models & Indexes
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => pingHealthEndpoint(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Ping /api/health</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Baseline) */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 space-y-10">
        {/* Section 1: Overview & Live Backend Status */}
        <section id="overview" className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>B1 · B2 · B3 · B4 · B5 · B6 Complete Backend Specification</span>
                <span aria-hidden="true">·</span>
                <span>Express + TypeScript + Mongoose + Zod</span>
                <span aria-hidden="true">·</span>
                <span>Port {health?.environment.port ?? 3000}</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display"
                style={{ textWrap: 'balance' }}
              >
                Clinical Directory, Patient Tracking & Analytics Backend Console
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Standalone Node.js + Express REST backend with Mongoose schema validation,
                full-text and compound indexes, rate-limited JWT authentication, and protected{' '}
                <code className="text-xs font-mono text-slate-800">/api/doctors</code>,{' '}
                <code className="text-xs font-mono text-slate-800">/api/patients</code>, and{' '}
                <code className="text-xs font-mono text-slate-800">/api/dashboard/stats</code> endpoints.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
              {health?.database.connected ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>MongoDB {health.database.readyStateLabel} ({health.database.mode})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>{loading ? 'Checking database...' : 'Database disconnected'}</span>
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>HTTP {httpStatus ?? '---'}</span>
              <span aria-hidden="true">·</span>
              <span>{latencyMs !== null ? `${latencyMs} ms` : '-- ms'}</span>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => pingHealthEndpoint(false)}
                className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          )}

          {health?.database.warning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-amber-900">
                <div className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    MongoDB Atlas IP Whitelist Required (Running on In-Memory Fallback)
                  </span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Credentials for <code className="font-mono">doctortracker.bc7oooa.mongodb.net</code> are configured, but Atlas blocked the cloud container IP. Add <code className="font-mono font-semibold">0.0.0.0/0</code> under <strong>Network Access → IP Access List</strong> in MongoDB Atlas, then click <strong>Reconnect Atlas Cluster</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => pingHealthEndpoint(true)}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reconnect Atlas Cluster
              </button>
            </div>
          )}

          {/* 4-Column Metric Summary Strip (Single-Elevation) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Health Endpoint</span>
                <Activity className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                GET /api/health
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                Status: {health?.status === 'ok' ? '200 OK' : loading ? 'Probing...' : 'Unavailable'} · Uptime: {health?.uptimeSeconds ?? 0}s
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Mongoose Persistence</span>
                <Database className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                {health?.database.databaseName || 'doctor-tracker'}
              </div>
              <div className="text-xs text-slate-500">
                Mode: {health?.database.mode || 'initializing'} · State: {health?.database.readyStateLabel || 'connecting'}
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>B2 Auth & Rate Limit</span>
                <KeyRound className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                10 req / 15m
              </div>
              <div className="text-xs text-slate-500">
                HS256 ({health?.environment.jwtExpiresIn || '15m'}) · requireRole("admin")
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Synchronized Indexes</span>
                <Server className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                {loading ? '...' : `${totalLiveIndexes} Active Indexes`}
              </div>
              <div className="text-xs text-slate-500">
                User · Doctor · Patient collections
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: B2 Interactive Authentication & Middleware Tester */}
        <section id="auth-console" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                01. B2 Authentication & Route Protection Tester
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Test <code className="font-mono">POST /api/auth/login</code> (Zod validation, bcrypt verification, 10 req / 15 min rate limit) and{' '}
                <code className="font-mono">GET /api/auth/me</code> protected by <code className="font-mono">auth + requireRole("admin")</code>.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Login Rate Limit Remaining: {rateLimitRemaining} / {rateLimitLimit} (15m window)
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <form onSubmit={handleTestLogin} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 font-display">
                    POST /api/auth/login
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Default Admin Seeded
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">
                    Admin Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="text"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                    required
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Authenticate Admin</span>
                  </button>

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => {
                      setLoginPassword('wrong-password');
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Set Wrong Password
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="text-xs font-semibold text-slate-900">
                  Test Protected Endpoint: <code className="font-mono">GET /api/auth/me</code>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={authLoading || !authToken}
                    onClick={() => handleTestGetMe(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Call /me with Bearer Token</span>
                  </button>

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => handleTestGetMe(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Call /me Without Token (401)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-4 text-xs font-mono tabular-nums">
                <span className="font-semibold text-slate-900">{authEndpointLabel}</span>
                <div className="flex items-center gap-3">
                  <span>
                    RateLimit: {rateLimitRemaining}/{rateLimitLimit}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      authStatus === 200
                        ? 'text-emerald-700 font-semibold'
                        : authStatus
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-500'
                    }
                  >
                    HTTP {authStatus ?? '---'}
                  </span>
                </div>
              </div>

              <pre className="p-6 text-xs font-mono tabular-nums bg-slate-950 text-slate-100 overflow-x-auto flex-1 leading-relaxed min-h-[260px]">
                {authLoading
                  ? 'Executing request...'
                  : authResponsePayload
                  ? JSON.stringify(authResponsePayload, null, 2)
                  : 'Click "Authenticate Admin" to test POST /api/auth/login and unlock B3, B4 & B5 endpoints.'}
              </pre>
            </div>
          </div>
        </section>

        {/* Section 3: B3 Doctor & Patient Management Explorer */}
        <section id="b3-doctors" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                02. B3 Doctor & Nested Patient Management API (/api/doctors)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Protected by <code className="font-mono">auth + requireRole("admin")</code>. Supports MongoDB text search,{' '}
                <code className="font-mono">GET /api/doctors/filters/options</code>, <code className="font-mono">Promise.all</code> pagination, and nested patient management.
              </p>
            </div>
            {b3Message && (
              <div className="text-xs font-mono text-sky-700">
                {b3Message}
              </div>
            )}
          </div>

          {!authToken ? (
            <div className="p-6 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                All <code className="font-mono text-slate-800">/api/doctors</code> endpoints require an admin Bearer JWT. Click <strong>Authenticate Admin</strong> above to load live doctors and filter options.
              </div>
              <button
                type="button"
                onClick={() => handleTestLogin()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Authenticate & Load Doctors
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-bold text-slate-900 font-display">
                      GET /api/doctors
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      Total: {doctorPagination.total} · Page {doctorPagination.page}/{doctorPagination.totalPages}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      placeholder="Text index search..."
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-36 focus:outline-none focus:border-sky-600"
                    />
                    <select
                      value={docSpecialization}
                      onChange={(e) => {
                        setDocSpecialization(e.target.value);
                        fetchB3DoctorsAndOptions(authToken, docSearch, e.target.value, docHospital);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="">All Specializations</option>
                      {filterOptions.specializations.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={docHospital}
                      onChange={(e) => {
                        setDocHospital(e.target.value);
                        fetchB3DoctorsAndOptions(authToken, docSearch, docSpecialization, e.target.value);
                      }}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="">All Hospitals</option>
                      {filterOptions.hospitals.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => fetchB3DoctorsAndOptions()}
                      disabled={docLoading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Filter
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/30">
                        <th className="py-2.5 px-6">Doctor</th>
                        <th className="py-2.5 px-4">Specialization · Hospital</th>
                        <th className="py-2.5 px-4">Contact</th>
                        <th className="py-2.5 px-6 text-right">Patients</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-xs">
                      {doctors.map((doc) => (
                        <tr
                          key={doc._id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`cursor-pointer transition-colors ${
                            selectedDoctor?._id === doc._id
                              ? 'bg-sky-50/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                            {doc.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {doc.specialization} · {doc.hospital}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {doc.email}
                          </td>
                          <td className="py-3 px-6 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoctor(doc);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
                            >
                              Inspect Patients
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form
                  onSubmit={handleCreateDoctor}
                  className="p-5 border-t border-slate-200 bg-slate-50/40 space-y-3"
                >
                  <div className="text-xs font-semibold text-slate-900">
                    POST /api/doctors (Returns 409 if email exists)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Dr. Full Name"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      required
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Specialization"
                      value={newDocSpec}
                      onChange={(e) => setNewDocSpec(e.target.value)}
                      required
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Hospital"
                      value={newDocHosp}
                      onChange={(e) => setNewDocHosp(e.target.value)}
                      required
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={newDocPhone}
                      onChange={(e) => setNewDocPhone(e.target.value)}
                      required
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="email"
                      placeholder="Email (unique)"
                      value={newDocEmail}
                      onChange={(e) => setNewDocEmail(e.target.value)}
                      required
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Doctor</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-600" />
                      <span className="text-sm font-bold text-slate-900 font-display">
                        {selectedDoctor ? `${selectedDoctor.name} — Patients` : 'Select a Doctor'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      GET /api/doctors/:id/patients · Total: {patientPagination.total}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search name/phone..."
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-36 focus:outline-none focus:border-sky-600"
                  />
                </div>

                <div className="divide-y divide-slate-200/70 text-xs">
                  {doctorPatients.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      No patients found for this doctor.
                    </div>
                  ) : (
                    doctorPatients.map((pat) => (
                      <div
                        key={pat._id}
                        className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80"
                      >
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-900">
                            {pat.name} · <span className="font-mono tabular-nums">{pat.age}y</span> · {pat.gender}
                          </div>
                          <div className="text-slate-500">
                            {pat.condition} · <span className="font-mono">{pat.phone}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoctorPatient(pat._id)}
                          title="DELETE /api/doctors/:id/patients/:patientId"
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {selectedDoctor && (
                  <form
                    onSubmit={handleCreatePatient}
                    className="p-5 border-t border-slate-200 bg-slate-50/40 space-y-3"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      POST /api/doctors/:id/patients
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Patient Name"
                        value={newPatName}
                        onChange={(e) => setNewPatName(e.target.value)}
                        required
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="number"
                        placeholder="Age"
                        value={newPatAge}
                        onChange={(e) => setNewPatAge(e.target.value)}
                        required
                        min={0}
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                      />
                      <input
                        type="text"
                        placeholder="Gender"
                        value={newPatGender}
                        onChange={(e) => setNewPatGender(e.target.value)}
                        required
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Phone"
                        value={newPatPhone}
                        onChange={(e) => setNewPatPhone(e.target.value)}
                        required
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Medical Condition"
                        value={newPatCondition}
                        onChange={(e) => setNewPatCondition(e.target.value)}
                        required
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Patient</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Section 4: B4 Global Patient Management API (/api/patients) */}
        <section id="b4-patients" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                03. B4 Patient Management API (/api/patients)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Populates <code className="font-mono">doctor</code> with only <code className="font-mono">name</code> &{' '}
                <code className="font-mono">specialization</code>, provides <code className="font-mono">GET /api/patients/filters/options</code>,{' '}
                <code className="font-mono">PATCH /api/patients/:id</code>, and <code className="font-mono">DELETE /api/patients/:id</code>.
              </p>
            </div>
            {b4Message && (
              <div className="text-xs font-mono text-sky-700">
                {b4Message}
              </div>
            )}
          </div>

          {!authToken ? (
            <div className="p-6 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                Authenticate via B2 Login to query <code className="font-mono text-slate-800">/api/patients</code> with populated doctor details.
              </div>
              <button
                type="button"
                onClick={() => handleTestLogin()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Authenticate & Load Patients
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-bold text-slate-900 font-display">
                    GET /api/patients
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    Total: {allPatientsPagination.total} · Page {allPatientsPagination.page}/{allPatientsPagination.totalPages}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={b4Search}
                    onChange={(e) => setB4Search(e.target.value)}
                    placeholder="Search name/phone..."
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-36 focus:outline-none focus:border-sky-600"
                  />
                  <select
                    value={b4Condition}
                    onChange={(e) => {
                      setB4Condition(e.target.value);
                      fetchB4PatientsAndOptions(authToken, b4Search, e.target.value, b4DoctorFilter);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="">All Conditions ({conditionOptions.length})</option>
                    {conditionOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={b4DoctorFilter}
                    onChange={(e) => {
                      setB4DoctorFilter(e.target.value);
                      fetchB4PatientsAndOptions(authToken, b4Search, b4Condition, e.target.value);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                  >
                    <option value="">All Doctors</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => fetchB4PatientsAndOptions()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Filter
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/30">
                      <th className="py-2.5 px-6">Patient</th>
                      <th className="py-2.5 px-4">Age · Gender · Phone</th>
                      <th className="py-2.5 px-4">Condition (PATCH editable)</th>
                      <th className="py-2.5 px-4">Populated Doctor (name · specialization)</th>
                      <th className="py-2.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-xs">
                    {allPatients.map((pat) => {
                      const popDoc =
                        typeof pat.doctor === 'object' && pat.doctor !== null
                          ? (pat.doctor as PopulatedDoctorRef)
                          : null;
                      return (
                        <tr key={pat._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                            {pat.name}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {pat.age}y · {pat.gender} · {pat.phone}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {editingPatientId === pat._id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingCondition}
                                  onChange={(e) => setEditingCondition(e.target.value)}
                                  className="px-2 py-1 text-xs bg-white border border-sky-500 rounded w-40"
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePatchPatient(pat._id)}
                                  className="px-2 py-1 text-xs font-semibold text-white bg-sky-600 rounded cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <span>{pat.condition}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {popDoc
                              ? `${popDoc.name} · ${popDoc.specialization}`
                              : String(pat.doctor)}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPatientId(pat._id);
                                setEditingCondition(pat.condition);
                              }}
                              title="PATCH /api/patients/:id"
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePatientDirect(pat._id)}
                              title="DELETE /api/patients/:id"
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 5: B5 Dashboard Analytics API (/api/dashboard/stats) */}
        <section id="b5-dashboard" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                04. B5 Dashboard Analytics API (GET /api/dashboard/stats)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                MongoDB aggregation pipelines run concurrently via <code className="font-mono">Promise.all</code>: top 10 doctors (<code className="font-mono">$lookup</code>), zero-filled daily patients, 8-week doctor growth, and condition breakdown.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!authToken || dashboardLoading}
                onClick={handleRunB6Seed}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Re-Seed B6 Dataset (25 Doctors · 200 Patients)
              </button>
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={!authToken || dashboardLoading}
                    onClick={() => {
                      setDashboardDays(d);
                      fetchB5DashboardStats(authToken, d);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      dashboardDays === d
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ?days={d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!authToken ? (
            <div className="p-6 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                Authenticate via B2 Login to run the parallel MongoDB aggregation pipelines on <code className="font-mono text-slate-800">GET /api/dashboard/stats</code>.
              </div>
              <button
                type="button"
                onClick={() => handleTestLogin()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Authenticate & Load Analytics
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top 4 Aggregation Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs text-slate-500">totalDoctors</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {dashboardStats?.totalDoctors ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    newThisWeek.doctors: +{dashboardStats?.newThisWeek.doctors ?? 0}
                  </div>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs text-slate-500">totalPatients</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {dashboardStats?.totalPatients ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    newThisWeek.patients: +{dashboardStats?.newThisWeek.patients ?? 0}
                  </div>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs text-slate-500">patientsOverTime Window</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {dashboardStats?.patientsOverTime.length ?? dashboardDays} Days
                  </div>
                  <div className="text-xs text-slate-500">
                    Missing days zero-filled ({dashboardDays}d series)
                  </div>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="text-xs text-slate-500">doctorsOverTime Window</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {dashboardStats?.doctorsOverTime.length ?? 8} Weeks
                  </div>
                  <div className="text-xs text-slate-500">
                    Weekly buckets · {dashboardStats?.conditionBreakdown.length ?? 0} distinct conditions
                  </div>
                </div>
              </div>

              {/* Aggregation Tables: Top 10 Doctors ($lookup) & Condition Breakdown ($group) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-sky-600" />
                      <span className="text-sm font-bold text-slate-900 font-display">
                        patientsPerDoctor (Top 10 · $group + $lookup)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      Sorted by count DESC
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/30">
                        <th className="py-2.5 px-6">Doctor Name</th>
                        <th className="py-2.5 px-4">Specialization · Hospital</th>
                        <th className="py-2.5 px-6 text-right">Patient Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-xs">
                      {dashboardStats?.patientsPerDoctor.map((item) => (
                        <tr key={item.doctorId} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-6 font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {item.specialization} · {item.hospital}
                          </td>
                          <td className="py-2.5 px-6 text-right font-mono tabular-nums font-semibold text-sky-700">
                            {item.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 font-display">
                      conditionBreakdown ($group by condition)
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {dashboardStats?.conditionBreakdown.length ?? 0} conditions
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/30">
                        <th className="py-2.5 px-6">Condition</th>
                        <th className="py-2.5 px-6 text-right">Patients</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-xs">
                      {dashboardStats?.conditionBreakdown.map((c) => (
                        <tr key={c.condition} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-6 font-medium text-slate-900">
                            {c.condition}
                          </td>
                          <td className="py-2.5 px-6 text-right font-mono tabular-nums font-semibold text-slate-700">
                            {c.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 6: Mongoose Models & Schema Explorer */}
        <section id="models" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                05. Mongoose Domain Models & Field Definitions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect field types, required validators, reference links, and declared indexes per model.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                {(['ALL', 'User', 'Doctor', 'Patient'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedModel(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedModel === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Models (3)' : tab}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter fields or indexes..."
                  aria-label="Filter fields or indexes"
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600 w-52"
                />
              </div>
            </div>
          </div>

          {filteredModels.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center space-y-3">
              <p className="text-sm text-slate-600">
                No Mongoose models or schema fields match "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedModel('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredModels.map((model) => {
                const liveCol = health?.database.collections.find(
                  (c) => c.name === model.collectionName
                );
                return (
                  <div
                    key={model.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 font-display">
                            {model.id} Model
                          </h3>
                          <span className="text-xs text-slate-400" aria-hidden="true">
                            ·
                          </span>
                          <code className="text-xs font-mono text-slate-600">
                            {model.filePath}
                          </code>
                        </div>
                        <p className="text-xs text-slate-500">{model.summary}</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span>Collection: {model.collectionName}</span>
                        <span aria-hidden="true">·</span>
                        <span>Documents: {liveCol?.documentCount ?? 0}</span>
                        <span aria-hidden="true">·</span>
                        <span>Live Indexes: {liveCol?.indexes.length ?? model.declaredIndexes.length}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/30">
                            <th className="py-2.5 px-6">Field Name</th>
                            <th className="py-2.5 px-4">Mongoose Type</th>
                            <th className="py-2.5 px-4">Required</th>
                            <th className="py-2.5 px-4">Constraints & Indexing</th>
                            <th className="py-2.5 px-6">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 text-xs">
                          {model.fields.map((f) => (
                            <tr
                              key={f.field}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-2.5 px-6 font-mono font-medium text-slate-900 whitespace-nowrap">
                                {f.field}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-sky-700 whitespace-nowrap">
                                {f.type}
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                {f.required ? 'true' : 'false'}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-600">
                                {f.constraints}
                              </td>
                              <td className="py-2.5 px-6 text-slate-600">
                                {f.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 7: Live Database Indexes Verification */}
        <section id="indexes" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                06. Synchronized MongoDB Indexes (Live Introspection)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time index definitions reported directly by{' '}
                <code className="font-mono text-slate-700">model.collection.indexes()</code> on the connected MongoDB instance.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Total Active Indexes: {totalLiveIndexes}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                    <th className="py-3 px-6">Collection</th>
                    <th className="py-3 px-4">Index Name</th>
                    <th className="py-3 px-4">Index Key / Weights Specification</th>
                    <th className="py-3 px-6 text-right">Properties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs font-mono tabular-nums">
                  {loading && !health ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                        Loading live MongoDB index table...
                      </td>
                    </tr>
                  ) : health?.database.collections && health.database.collections.length > 0 ? (
                    health.database.collections.flatMap((col) =>
                      col.indexes.map((idx) => (
                        <tr
                          key={`${col.name}-${idx.name}`}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-2.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                            {col.name}
                          </td>
                          <td className="py-2.5 px-4 text-sky-700 whitespace-nowrap">
                            {idx.name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            {idx.weights
                              ? `Text Weights: ${JSON.stringify(idx.weights)}`
                              : JSON.stringify(idx.key)}
                          </td>
                          <td className="py-2.5 px-6 text-right text-slate-500 whitespace-nowrap font-sans">
                            {idx.unique
                              ? 'unique'
                              : idx.textIndexVersion
                              ? `text index (v${idx.textIndexVersion})`
                              : 'standard / compound'}
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                        No live indexes found. Click "Ping /api/health" to refresh.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 8: Live API Inspector & Backend Folder Structure */}
        <section id="inspector" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/60">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  07. Live Response Inspector · GET /api/health
                </h2>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  HTTP {httpStatus ?? 200} · Latency {latencyMs ?? '--'} ms · Updated{' '}
                  {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '--'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyJson}
                disabled={!health}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Payload</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-6 text-xs font-mono tabular-nums bg-slate-950 text-slate-100 overflow-x-auto flex-1 leading-relaxed max-h-[420px]">
              {health
                ? JSON.stringify(health, null, 2)
                : loading
                ? 'Fetching live response from GET /api/health...'
                : 'No payload available.'}
            </pre>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  08. Backend Directory Layout & Scripts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modular TypeScript layout configured in <code className="font-mono">doctor-tracker-api</code>.
                </p>
              </div>

              <div className="divide-y divide-slate-200/70 text-xs">
                {ARCHITECTURE_MODULES.map((item) => (
                  <div key={item.folder} className="px-6 py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <span className="font-semibold text-slate-900">{item.folder}</span>
                      <span className="text-slate-500">{item.file}</span>
                    </div>
                    <p className="text-slate-500">{item.role}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600 font-mono tabular-nums flex flex-wrap items-center justify-between gap-2">
              <span>npm run dev</span>
              <span aria-hidden="true">·</span>
              <span>npm run build</span>
              <span aria-hidden="true">·</span>
              <span>npm start</span>
              <span aria-hidden="true">·</span>
              <span>npm run seed</span>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>doctor-tracker-api · B1–B6 Complete Backend API</span>
          <span>Express · Mongoose · Zod · JWT (HS256, 15m TTL) · BcryptJS · Express-Rate-Limit</span>
        </div>
      </footer>
    </div>
  );
}
