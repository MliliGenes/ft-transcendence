import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JudgeInfraError } from 'arena-game-engine';

interface ExceptionDetails {
  readonly code?: unknown;
  readonly name?: unknown;
  readonly message?: unknown;
}

function isExceptionDetails(value: unknown): value is ExceptionDetails {
  return typeof value === 'object' && value !== null;
}

/** Maps engine error codes to HTTP status; unknown faults become 500 without leaking internals. */
@Catch()
export class EngineErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({ error: exception.message });
      return;
    }

    const details: ExceptionDetails = isExceptionDetails(exception)
      ? exception
      : {};
    const code = details.code;
    const name = details.name;
    const message =
      typeof details.message === 'string' ? details.message : 'internal error';

    // Judge infrastructure failures:
    // 1. Direct typed JudgeInfraError instance from arena-game-engine.
    // 2. Cross-realm / dual-package hazard: name === 'JudgeInfraError' ensures robust classification
    //    if multiple package copies exist across workspace boundaries.
    // 3. Upstream worker HTTP 503 errors tagged with status code 503.
    const isJudgeInfra =
      exception instanceof JudgeInfraError ||
      name === 'JudgeInfraError' ||
      code === 503;

    const status =
      isJudgeInfra
        ? HttpStatus.SERVICE_UNAVAILABLE
        : code === 403
          ? HttpStatus.FORBIDDEN
          : code === 409
            ? HttpStatus.CONFLICT
            : code === 400
              ? HttpStatus.BAD_REQUEST
              : code === 429
                ? HttpStatus.TOO_MANY_REQUESTS
                : code === 404
                  ? HttpStatus.NOT_FOUND
                  : code === 410
                    ? HttpStatus.GONE
                    : HttpStatus.INTERNAL_SERVER_ERROR;
    const safe =
      isJudgeInfra
        ? 'judge unavailable'
        : status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'internal error'
          : message;
    res.status(status).json({ error: safe });
  }
}
