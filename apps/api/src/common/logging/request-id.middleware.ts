import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
): void {
  request.requestId = request.header('X-Request-ID') ?? randomUUID();
  response.setHeader('X-Request-ID', request.requestId);
  next();
}
