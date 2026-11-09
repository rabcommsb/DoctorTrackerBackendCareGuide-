import { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRequestHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async Express controller function and forwards any rejected promise
 * or thrown exception to the central Express error-handling middleware (`next(err)`).
 */
export const asyncHandler = <TReq extends Request = Request>(
  fn: AsyncRequestHandler<TReq>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
};

export default asyncHandler;
