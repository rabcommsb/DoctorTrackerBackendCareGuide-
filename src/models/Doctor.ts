import mongoose, { Document, Schema } from 'mongoose';

export interface IDoctor extends Document {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
    },
    hospital: {
      type: String,
      required: [true, 'Hospital is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes:
// 1. Text index on name, email, hospital
doctorSchema.index(
  { name: 'text', email: 'text', hospital: 'text' },
  { name: 'doctor_text_idx' }
);

// 2. Compound index on { specialization: 1, createdAt: -1 }
doctorSchema.index(
  { specialization: 1, createdAt: -1 },
  { name: 'specialization_createdAt_idx' }
);

// 3. Single-field index on { hospital: 1 }
doctorSchema.index({ hospital: 1 }, { name: 'hospital_idx' });

export const Doctor =
  (mongoose.models.Doctor as mongoose.Model<IDoctor>) ||
  mongoose.model<IDoctor>('Doctor', doctorSchema);

export default Doctor;
