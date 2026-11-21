import { Injectable } from "@nestjs/common";
import { InvalidPhoto, renderPhoto } from "./photo-renditions";
import {
  originalPhotoKey,
  photoRenditionKey,
  PhotoStorage,
} from "./photo-storage";
import { PhotoWorkQueue } from "./photo-work-queue";

@Injectable()
export class PhotoWorkerService {
  constructor(
    private readonly queue: PhotoWorkQueue,
    private readonly storage: PhotoStorage,
  ) {}

  async runOnce(): Promise<boolean> {
    const work = await this.queue.claim();
    if (!work) return false;
    let renditions: Awaited<ReturnType<typeof renderPhoto>>;
    try {
      const bytes = await this.storage.readOriginal(
        originalPhotoKey(work.projectId, work.id),
      );
      renditions = await renderPhoto(bytes, work);
      await this.storage.putWebp(
        photoRenditionKey(work.projectId, work.id, work.leaseToken, "display"),
        renditions.display.data,
      );
      await this.storage.putWebp(
        photoRenditionKey(work.projectId, work.id, work.leaseToken, "thumb"),
        renditions.thumb.data,
      );
    } catch (error) {
      await this.queue.fail(work, error instanceof InvalidPhoto);
      return true;
    }
    await this.queue.ready(
      work,
      renditions.display.info.width,
      renditions.display.info.height,
    );
    return true;
  }
}
