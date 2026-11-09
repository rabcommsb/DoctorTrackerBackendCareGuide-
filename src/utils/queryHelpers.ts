import { SortOrder } from 'mongoose';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Shared pagination calculation helper.
 * Normalizes page (>= 1) and limit (1..maxLimit) and computes MongoDB skip offset.
 */
export const getPaginationParams = (
  page = 1,
  limit = 10,
  maxLimit = 50
): PaginationParams => {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(
    maxLimit,
    Math.max(1, Math.floor(Number(limit) || 10))
  );
  const skip = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    skip,
  };
};

/**
 * Builds the standardized pagination response metadata object.
 */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
  };
};

/**
 * Shared date-range filter builder for `createdAt` queries.
 * Supports ISO timestamps and YYYY-MM-DD date strings (inclusive of end-of-day for `to`).
 */
export const buildDateRangeFilter = (
  from?: string,
  to?: string
): Record<string, Date> | undefined => {
  if (!from && !to) {
    return undefined;
  }

  const range: Record<string, Date> = {};

  if (from && from.trim().length > 0) {
    range.$gte = new Date(from.trim());
  }

  if (to && to.trim().length > 0) {
    const trimmedTo = to.trim();
    const toDate = new Date(trimmedTo);
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedTo)) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
    range.$lte = toDate;
  }

  return Object.keys(range).length > 0 ? range : undefined;
};

/**
 * Shared sort string parser (e.g. "-createdAt", "name", "condition,-createdAt").
 */
export const parseSortParam = (
  sortStr: string | undefined,
  allowedFields: string[]
): Record<string, SortOrder> => {
  const sortObj: Record<string, SortOrder> = {};
  const parts = (sortStr || '-createdAt')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const isDesc = part.startsWith('-');
    const rawField = isDesc
      ? part.slice(1)
      : part.startsWith('+')
      ? part.slice(1)
      : part;
    if (allowedFields.includes(rawField)) {
      sortObj[rawField] = isDesc ? -1 : 1;
    }
  }

  if (Object.keys(sortObj).length === 0) {
    sortObj.createdAt = -1;
  }

  return sortObj;
};
