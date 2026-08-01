import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { DomainError } from '../errors/domain-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<{ requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'حدث خطأ داخلي غير متوقع.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      code = 'RESOURCE_CONFLICT';
      message = 'توجد بيانات مسجلة بنفس القيم الفريدة.';
      details = { target: exception.meta?.target };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const objectBody = body as { message?: string | string[]; error?: string };
        message = Array.isArray(objectBody.message)
          ? objectBody.message.join('، ')
          : objectBody.message ?? message;
      }
      code = status === 401 ? 'AUTH_SESSION_EXPIRED' : status === 403 ? 'PERMISSION_DENIED' : 'REQUEST_FAILED';
    }

    response.status(status).json({
      error: { code, message, details, fieldErrors: [] },
      meta: { requestId: request.requestId },
    });
  }
}
