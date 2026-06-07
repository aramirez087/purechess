import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Sentry } from "./sentry";
import type { PosthogService } from "../analytics/posthog.service";

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    username?: string;
    isAdmin?: boolean;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly posthog?: PosthogService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isServerError = status >= 500;

    if (isServerError) {
      Sentry.withScope((scope) => {
        if (request.user) {
          scope.setUser({
            id: request.user.id,
            username: request.user.username,
            isAdmin: request.user.isAdmin,
          } as Record<string, unknown>);
        }
        Sentry.captureException(exception);
      });

      this.posthog?.captureException(exception, request.user?.id);

      this.logger.error(
        {
          err: exception,
          requestId: (request as Request & { id?: string }).id,
        },
        "Unhandled exception",
      );
    }

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    response
      .status(status)
      .json(
        typeof message === "object" ? message : { statusCode: status, message },
      );
  }
}
