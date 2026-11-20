import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./http/api-exception.filter";
import { webOrigin } from "./http/web-origin";
import { createValidationPipe } from "./http/validation-pipe";

export async function createApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const origin = webOrigin();
  if (origin)
    app.enableCors({
      origin,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "Idempotency-Key"],
      exposedHeaders: ["Retry-After"],
      credentials: true,
    });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(createValidationPipe());
  return app;
}
export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Повод API")
      .setVersion("0.9.0")
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
