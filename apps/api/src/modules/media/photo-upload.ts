import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UseGuards,
  UseInterceptors,
  type CallHandler,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiHeader } from "@nestjs/swagger";
import type { Request } from "express";
import { finalize } from "rxjs";
import { ApiError } from "../../http/api-error";
import { webOrigin } from "../../http/web-origin";
import { CsrfGuard } from "../identity/csrf.guard";
import { MAX_PHOTO_BYTES } from "./photo-input";

@Injectable()
export class PhotoOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = webOrigin();
    if (!origin || request.get("Origin") !== origin)
      throw new ApiError(403, "CSRF_FAILED", "Недопустимый источник запроса");
    if (!request.is("multipart/form-data"))
      throw new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Передайте файл multipart/form-data",
      );
    return true;
  }
}

const ParsePhoto = FileInterceptor("file", {
  limits: { fileSize: MAX_PHOTO_BYTES + 1, files: 1, fields: 0, parts: 2 },
});

@Injectable()
export class PhotoUploadInterceptor extends ParsePhoto {
  private inFlight = 0;

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (this.inFlight >= 2)
      throw new ApiError(
        429,
        "PHOTO_UPLOAD_BUSY",
        "Слишком много одновременных загрузок",
      );
    this.inFlight++;
    try {
      return (await super.intercept(context, next)).pipe(
        finalize(() => this.inFlight--),
      );
    } catch (error) {
      this.inFlight--;
      if (error instanceof HttpException && error.getStatus() === 400)
        throw new ApiError(
          400,
          "MALFORMED_UPLOAD",
          "Ожидается один файл в поле file",
        );
      throw error;
    }
  }
}

export function PhotoUpload() {
  return applyDecorators(
    UseGuards(PhotoOriginGuard, CsrfGuard),
    UseInterceptors(PhotoUploadInterceptor),
    ApiConsumes("multipart/form-data"),
    ApiHeader({
      name: "Idempotency-Key",
      required: true,
      schema: { type: "string", format: "uuid" },
    }),
    ApiHeader({ name: "X-CSRF-Token", required: true }),
    ApiBody({
      schema: {
        type: "object",
        required: ["file"],
        properties: { file: { type: "string", format: "binary" } },
      },
    }),
  );
}
