import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { PhotoStorage } from "./photo-storage";
import { PhotoWorkQueue } from "./photo-work-queue";
import { PhotoWorkerService } from "./photo-worker.service";

@Module({
  imports: [DatabaseModule],
  providers: [PhotoStorage, PhotoWorkQueue, PhotoWorkerService],
})
export class PhotoWorkerModule {}
