import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { setTimeout } from "node:timers/promises";
import sharp from "sharp";
import { DatabaseService } from "./database/database.service";
import { PhotoStorage } from "./modules/media/photo-storage";
import { PhotoWorkerModule } from "./modules/media/photo-worker.module";
import { PhotoWorkerService } from "./modules/media/photo-worker.service";

export async function startPhotoWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(
    PhotoWorkerModule,
    {
      logger: false,
      abortOnError: false,
    },
  );
  const stop = new AbortController();
  const requestStop = () => stop.abort();
  process.once("SIGINT", requestStop);
  process.once("SIGTERM", requestStop);
  try {
    context.get(DatabaseService).getClient();
    context.get(PhotoStorage).assertConfigured();
    sharp.concurrency(1);
    sharp.cache(false);
    const worker = context.get(PhotoWorkerService);
    console.info("Photo worker started.");
    while (!stop.signal.aborted) {
      let delay = 1_500;
      try {
        if (await worker.runOnce()) continue;
      } catch {
        console.error("Photo worker could not update the queue. Retrying.");
        delay = 5_000;
      }
      if (!stop.signal.aborted)
        await setTimeout(delay, undefined, { signal: stop.signal }).catch(
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
  startPhotoWorker().catch(() => {
    console.error(
      "Photo worker could not start. Check DATABASE_URL and the MEDIA_S3 settings.",
    );
    process.exitCode = 1;
  });
}
