import type { Request, Response } from 'express';
import app from '../src/app.ts';
import { connectDB } from '../src/config/db.ts';

export default async (req: Request, res: Response) => {
  await connectDB();
  return app(req, res);
};
