import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPatient extends Document {
  name: string;
  age: number;
  gender: string;
  phone: string;
  condition: string;
  doctor: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Patient age is required'],
      min: [0, 'Age cannot be negative'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    condition: {
      type: String,
      required: [true, 'Medical condition is required'],
      trim: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Assigned doctor reference is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes:
// 1. Text index on name and phone
patientSchema.index(
  { name: 'text', phone: 'text' },
  { name: 'patient_text_idx' }
);

// 2. Compound index on { doctor: 1, createdAt: -1 }
patientSchema.index(
  { doctor: 1, createdAt: -1 },
  { name: 'doctor_createdAt_idx' }
);

// 3. Compound index on { condition: 1, createdAt: -1 }
patientSchema.index(
  { condition: 1, createdAt: -1 },
  { name: 'condition_createdAt_idx' }
);

export const Patient =
  (mongoose.models.Patient as mongoose.Model<IPatient>) ||
  mongoose.model<IPatient>('Patient', patientSchema);

export default Patient;
