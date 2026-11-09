import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
} from '../utils/auth';
import { asyncHandler } from '../utils/asyncHandler';

export { asyncHandler };

/**
 * 404 Not Found middleware for unmatched routes.
 */
export const notFound = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const notFoundHandler = notFound;

/**
 * Central error-handling middleware returning `{ message, errors? }` with accurate HTTP status codes:
 * - Zod validation errors -> 400 Bad Request
 * - Mongoose duplicate key (code 11000) -> 409 Conflict
 * - Mongoose CastError -> 400 Bad Request
 * - Mongoose ValidationError -> 400 Bad Request
 * - JWT TokenExpiredError / JsonWebTokenError -> 401 Unauthorized
 * - PayloadTooLargeError (JSON > 1mb) -> 413 Payload Too Large
 * - Unknown errors -> 500 Internal Server Error (stack omitted in production)
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Zod validation error (400)
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'request',
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: formattedErrors,
      issues: err.issues,
    });
    return;
  }

  // 2. Mongoose duplicate key error E11000 (409)
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  ) {
    const keyValue =
      'keyValue' in err && typeof (err as { keyValue: unknown }).keyValue === 'object'
        ? ((err as { keyValue: Record<string, unknown> }).keyValue ?? {})
        : {};
    const fields = Object.keys(keyValue);
    const fieldLabel = fields.length > 0 ? fields.join(', ') : 'unique field';

    res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_KEY',
      message: `Duplicate value for ${fieldLabel}. A record with this ${fieldLabel} already exists.`,
      errors: fields.map((field) => ({
        field,
        value: keyValue[field],
        message: `${field} already exists`,
      })),
    });
    return;
  }

  // 3. Mongoose CastError (invalid ObjectId or type cast) (400)
  if (
    err instanceof mongoose.Error.CastError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: unknown }).name === 'CastError')
  ) {
    const castErr = err as mongoose.Error.CastError;
    res.status(400).json({
      status: 'error',
      code: 'CAST_ERROR',
      message: `Invalid ${castErr.path || 'parameter'}: ${String(castErr.value)}`,
      errors: [
        {
          field: castErr.path || 'id',
          value: castErr.value,
          message: `Invalid ${castErr.kind || 'ObjectId'} format for "${castErr.path || 'id'}"`,
        },
      ],
    });
    return;
  }

  // 4. Mongoose schema ValidationError (400)
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));

    res.status(400).json({
      status: 'error',
      code: 'MONGOOSE_VALIDATION_ERROR',
      message: 'Database validation failed',
      errors,
    });
    return;
  }

  // 5. JWT TokenExpiredError / NotBeforeError / JsonWebTokenError (401)
  if (err instanceof TokenExpiredError) {
    res.status(401).json({
      status: 'error',
      code: 'TOKEN_EXPIRED',
      message: 'JWT token has expired.',
      expiredAt: err.expiredAt.toISOString(),
    });
    return;
  }

  if (err instanceof NotBeforeError) {
    res.status(401).json({
      status: 'error',
      code: 'TOKEN_NOT_ACTIVE',
      message: 'JWT token is not yet active.',
    });
    return;
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: `JWT validation error: ${err.message}`,
    });
    return;
  }

  // 6. Express body-parser PayloadTooLargeError (413) or SyntaxError on malformed JSON (400)
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.too.large'
  ) {
    res.status(413).json({
      status: 'error',
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the 1mb limit.',
    });
    return;
  }

  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Malformed JSON in request body.',
    });
    return;
  }

  // 7. Custom statusCode or unknown error (default 500, no stack in production)
  const statusCode =
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;

  const message =
    statusCode === 500 && isProduction
      ? 'Internal Server Error'
      : err instanceof Error
        ? err.message
        : 'Internal Server Error';

  const customErrors =
    typeof err === 'object' &&
    err !== null &&
    'errors' in err &&
    Array.isArray((err as { errors: unknown }).errors)
      ? (err as { errors: unknown[] }).errors
      : undefined;

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(customErrors ? { errors: customErrors } : {}),
    ...(!isProduction && err instanceof Error && err.stack
      ? { stack: err.stack }
      : {}),
  });
};
