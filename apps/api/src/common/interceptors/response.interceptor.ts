import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();
    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload instanceof StreamableFile) return payload;
        if (payload && typeof payload === 'object' && 'data' in payload) {
          const objectPayload = payload as { data: unknown; meta?: Record<string, unknown> };
          return {
            data: objectPayload.data,
            meta: { ...objectPayload.meta, requestId: request.requestId },
          };
        }
        return { data: payload ?? null, meta: { requestId: request.requestId } };
      }),
    );
  }
}
