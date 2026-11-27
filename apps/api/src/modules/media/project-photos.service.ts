import { Injectable } from "@nestjs/common";
import { canEditProject, readPublicationClock } from "../publication/publication-lifecycle";
import { DatabaseService } from "../../database/database.service";
import type { ProjectPhoto } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { AssistedProjectsService } from "../administration/assisted-projects.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { inspectPhoto, MAX_PROJECT_PHOTOS, photoDigest } from "./photo-input";
import {
  originalPhotoKey,
  photoRenditionKey,
  PhotoStorage,
} from "./photo-storage";
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

  private async project(scope: PhotoScope) {
    if (scope.kind === "owner")
      return this.projects.owned(scope.actorId, scope.id);
    // This path is behind AdminGuard. Operators can preview any linked project;
    // mutations still use the separate assistance-only lock.
    const request = await this.database.getClient().serviceRequest.findUnique({
      where: { id: scope.id },
      select: { project: { select: { id: true, deletedAt: true } } },
    });
    if (!request?.project || request.project.deletedAt)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Проект не найден");
    return request.project;
  }

  async list(scope: PhotoScope): Promise<ProjectPhotoListDto> {
    const project = await this.project(scope);
    const items = await this.database.getClient().projectPhoto.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return { items: items.map(photoDto) };
  }

  async image(scope: PhotoScope, photoId: string): Promise<Buffer> {
    const project = await this.project(scope);
    const photo = await this.database.getClient().projectPhoto.findFirst({
      where: { id: photoId, projectId: project.id, status: "READY" },
      select: { renditionToken: true },
    });
    if (!photo?.renditionToken)
      throw new ApiError(404, "PHOTO_NOT_FOUND", "Готовое фото не найдено");
    return this.storage.readObject(
      photoRenditionKey(project.id, photoId, photo.renditionToken, "display"),
    );
  }

  async upload(
    scope: PhotoScope,
    file: { buffer: Buffer } | undefined,
    key: string,
  ): Promise<ProjectPhotoDto> {
    if (scope.kind === "owner")
      await this.projects.owned(scope.actorId, scope.id);
    else await this.assisted.linkedProject(scope.id);
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
      if (!canEditProject(project, await readPublicationClock(tx)))
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
