import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ApiError } from "./http/api-error";
import { ApiExceptionFilter } from "./http/api-exception.filter";
import { webOrigin } from "./http/web-origin";

export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const origin = webOrigin();
  if (origin)
    app.enableCors({
      origin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      exposedHeaders: ["Retry-After"],
      credentials: true,
    });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new ApiError(
          422,
          "VALIDATION_FAILED",
          "Проверьте поля",
          errors.map((error) => ({
            path: error.property,
            code: error.constraints?.whitelistValidation
              ? "UNKNOWN_FIELD"
              : "INVALID_VALUE",
          })),
        ),
    }),
  );
  return app;
}
export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Повод API")
      .setVersion("0.4.0")
      .addCookieAuth(
        "__Host-povod-session",
        { type: "apiKey", in: "cookie" },
        "session",
      )
      .build(),
  );
}
export function enableOpenApi(app: INestApplication): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_OPENAPI === "1"
  ) {
    SwaggerModule.setup("api/docs", app, createOpenApiDocument(app), {
      jsonDocumentUrl: "api/openapi.json",
    });
  }
}
