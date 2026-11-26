import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { setTimeout } from "node:timers/promises";
import { DatabaseModule } from "./database/database.module";
import { DatabaseService } from "./database/database.service";
import { PublicationExpiryService } from "./modules/publication/publication-expiry.service";

@Module({
  imports: [DatabaseModule],
  providers: [PublicationExpiryService],
})
class PublicationExpiryWorkerModule {}

async function startPublicationExpiryWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(
    PublicationExpiryWorkerModule,
    { logger: false, abortOnError: false },
  );
  const stop = new AbortController();
  const requestStop = () => stop.abort();
  process.once("SIGINT", requestStop);
  process.once("SIGTERM", requestStop);
  try {
    context.get(DatabaseService).getClient();
    const expiry = context.get(PublicationExpiryService);
    while (!stop.signal.aborted) {
      try {
        if (await expiry.runOnce()) continue;
      } catch {
        console.error("Publication expiry sweep failed. Retrying.");
      }
      if (!stop.signal.aborted)
        await setTimeout(30_000, undefined, { signal: stop.signal }).catch(
          (error: unknown) => {
            if (!stop.signal.aborted) throw error;
          },
        );
    }
  } finally {
    process.off("SIGINT", requestStop);
    process.off("SIGTERM", requestStop);
    await context.close();
  }
}

if (require.main === module) {
  startPublicationExpiryWorker().catch(() => {
    console.error("Publication expiry worker could not start. Check DATABASE_URL.");
    process.exitCode = 1;
  });
}
