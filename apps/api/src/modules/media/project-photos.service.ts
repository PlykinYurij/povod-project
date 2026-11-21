import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { ProjectPhoto } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { AssistedProjectsService } from "../administration/assisted-projects.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { inspectPhoto, MAX_PROJECT_PHOTOS, photoDigest } from "./photo-input";
import { originalPhotoKey, PhotoStorage } from "./photo-storage";
import type {
  ProjectPhotoDto,
  ProjectPhotoListDto,
} from "./project-photos.dto";

export type PhotoScope =
  | { kind: "owner"; actorId: string; id: string }
  | { kind: "assisted"; actorId: string; id: string };

function photoDto({
  id,
  status,
  width,
  height,
  renderWidth,
  renderHeight,
  byteSize,
  createdAt,
}: ProjectPhoto): ProjectPhotoDto {
  return {
    id,
    status,
    width: renderWidth ?? width,
    height: renderHeight ?? height,
    byteSize,
    createdAt: createdAt.toISOString(),
  };
}

@Injectable()
export class ProjectPhotosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projects: ProjectAccessService,
    private readonly assisted: AssistedProjectsService,
    private readonly storage: PhotoStorage,
  ) {}

  private project(scope: PhotoScope) {
    return scope.kind === "owner"
      ? this.projects.owned(scope.actorId, scope.id)
      : this.assisted.linkedProject(scope.id);
  }

  async list(scope: PhotoScope): Promise<ProjectPhotoListDto> {
    const project = await this.project(scope);
    const items = await this.database.getClient().projectPhoto.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { items: items.map(photoDto) };
  }

  async upload(
    scope: PhotoScope,
    file: { buffer: Buffer } | undefined,
    key: string,
  ): Promise<ProjectPhotoDto> {
    await this.project(scope);
    if (!file || !Buffer.isBuffer(file.buffer))
      throw new ApiError(422, "PHOTO_REQUIRED", "Выберите фото");
    const image = await inspectPhoto(file.buffer);
    const uploadKeyHash = photoDigest(key.toLowerCase());
    const client = this.database.getClient();
    const photo = await client.$transaction(async (tx) => {
      const project = await (scope.kind === "owner"
        ? this.projects.lockOwned(tx, scope.actorId, scope.id)
        : this.assisted.lockLinked(tx, scope.actorId, scope.id));
      const previous = await tx.projectPhoto.findUnique({
        where: {
          projectId_uploadKeyHash: { projectId: project.id, uploadKeyHash },
        },
      });
      if (previous) {
        if (previous.sha256 !== image.sha256)
          throw new ApiError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Ключ уже использован для другого фото",
          );
        return previous;
      }
      if (project.firstPublishedAt)
        throw new ApiError(
          409,
          "CONTENT_LOCKED",
          "Снимите приглашение с публикации перед загрузкой",
        );
      const count = await tx.projectPhoto.count({
        where: { projectId: project.id },
      });
      if (count >= MAX_PROJECT_PHOTOS)
        throw new ApiError(409, "PHOTO_LIMIT_REACHED", "Достигнут лимит фото");
      this.storage.assertConfigured();
      return tx.projectPhoto.create({
        data: { projectId: project.id, uploadKeyHash, ...image },
      });
    });
    if (photo.status !== "UPLOADING") return photoDto(photo);
    // Same key and digest always address the same original, including a retry after an ambiguous PUT.
    await this.storage.putOriginal(
      originalPhotoKey(photo.projectId, photo.id),
      file.buffer,
      photo.mime,
    );
    await client.projectPhoto.updateMany({
      where: { id: photo.id, status: "UPLOADING" },
      data: { status: "PROCESSING" },
    });
    return photoDto(
      await client.projectPhoto.findUniqueOrThrow({ where: { id: photo.id } }),
    );
  }
}
