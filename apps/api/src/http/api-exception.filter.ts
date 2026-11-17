import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { ApiError } from "./api-error";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof exception === "object" &&
            exception !== null &&
            "status" in exception &&
            [400, 413].includes(Number(exception.status))
          ? Number(exception.status)
          : 503;
    const fallback: Record<number, { code: string; message: string }> = {
      400: { code: "MALFORMED_JSON", message: "Некорректный JSON" },
      404: { code: "NOT_FOUND", message: "Маршрут не найден" },
      413: { code: "BODY_TOO_LARGE", message: "Слишком большой запрос" },
    };
    const details =
      exception instanceof ApiError
        ? exception.getResponse()
        : (fallback[status] ?? {
            code: "SERVICE_UNAVAILABLE",
            message: "Сервис временно недоступен",
          });
    response.setHeader("Cache-Control", "no-store");
    response.status(status).json({
      error: {
        ...(typeof details === "object" ? details : {}),
        requestId: randomUUID(),
      },
    });
  }
}
