import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { captureException } from '../../observability/sentry';

/**
 * Global HTTP exception filter. Two jobs:
 *
 *  1. Log every exception through the structured logger (see
 *     `JsonLogger`), instead of letting Nest's default handler print
 *     whatever it wants.
 *  2. Report unexpected failures to Sentry — the whole point of this block
 *     of work is that a crash in production (with in-app purchase live)
 *     shouldn't be something we only learn about from a user complaint.
 *
 * Deliberately does NOT report every 4xx to Sentry: a `NotFoundException`
 * or a validation `BadRequestException` is expected traffic, not an
 * incident. Only 5xx responses and exceptions that aren't `HttpException`
 * at all (bugs, unhandled cases) go to Sentry. The response body/shape for
 * `HttpException`s is unchanged from Nest's own default filter — this only
 * adds logging and reporting around it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    const isServerError = !isHttpException || status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isServerError) {
      this.logger.error(
        `${request?.method} ${request?.url} -> ${status}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      captureException(exception, {
        path: request?.url,
        method: request?.method,
        statusCode: status,
      });
    } else {
      this.logger.warn(`${request?.method} ${request?.url} -> ${status}`);
    }

    response.status(status).json(body);
  }
}
