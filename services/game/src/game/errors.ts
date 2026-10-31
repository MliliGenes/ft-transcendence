import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

const STATUS_BY_ERROR_CODE: Readonly<Record<number, HttpStatus>> = {
  503: HttpStatus.SERVICE_UNAVAILABLE,
  403: HttpStatus.FORBIDDEN,
  409: HttpStatus.CONFLICT,
  400: HttpStatus.BAD_REQUEST,
  429: HttpStatus.TOO_MANY_REQUESTS,
  404: HttpStatus.NOT_FOUND,
  410: HttpStatus.GONE,
};

function resolveHttpStatus(code: unknown): HttpStatus {
  if (typeof code === "number" && code in STATUS_BY_ERROR_CODE) {
    return STATUS_BY_ERROR_CODE[code];
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function resolveSafeErrorMessage(exception: unknown, status: HttpStatus): string {
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
    return "internal error";
  }
  return exception instanceof Error ? exception.message : "internal error";
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
    const code = (exception as { code?: unknown })?.code;
    const status = resolveHttpStatus(code);
    const safe = resolveSafeErrorMessage(exception, status);
    res.status(status).json({ error: safe });
  }
}
