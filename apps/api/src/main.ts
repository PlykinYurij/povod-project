import "reflect-metadata";
import { createApplication, enableOpenApi } from "./create-application";
import { startupErrorMessage } from "./startup-error";

async function bootstrap(): Promise<void> {
  const portValue = process.env.PORT ?? "3001";
  const port = Number(portValue);

  if (
    !/^\d+$/.test(portValue) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const app = await createApplication();
  enableOpenApi(app);
  app.enableShutdownHooks();

  try {
    await app.listen(port, "127.0.0.1");
    console.info(`API listening at http://127.0.0.1:${port}`);
  } catch (error: unknown) {
    await app.close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  console.error(startupErrorMessage(error));
  process.exitCode = 1;
});
