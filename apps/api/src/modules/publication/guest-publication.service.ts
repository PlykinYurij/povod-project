import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { RsvpFormSchema } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { photoRenditionKey, PhotoStorage } from "../media/photo-storage";
import { validateGardenContent } from "../templates/garden/validate-garden";
import { describeRsvpForm } from "../rsvp/rsvp-form";
import {
  activePublicationBySlug,
  invitationUnavailable,
} from "./active-publication";
import type { GuestPublicationDto } from "./guest-publication.dto";

@Injectable()
export class GuestPublicationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: PhotoStorage,
  ) {}

  async get(slug: string): Promise<GuestPublicationDto> {
    const snapshot = await this.snapshot(slug);
    const cover = await this.findCover(
      snapshot.projectId,
      snapshot.content.heroMediaId,
    );
    return {
      templateVersionId: snapshot.templateVersionId,
      snapshotId: snapshot.id,
      content: { ...snapshot.content, heroMediaId: cover ? snapshot.id : null },
      cover: cover ? { width: cover.width, height: cover.height } : null,
      rsvp: describeRsvpForm(snapshot.id, snapshot.formSchema),
    };
  }

  async cover(slug: string, snapshotId: string): Promise<Buffer> {
    const snapshot = await this.snapshot(slug);
    if (snapshot.id !== snapshotId.toLowerCase()) throw invitationUnavailable();
    const cover = await this.findCover(
      snapshot.projectId,
      snapshot.content.heroMediaId,
    );
    if (!cover) throw invitationUnavailable();
    return this.storage.readObject(
      photoRenditionKey(snapshot.projectId, cover.id, cover.token, "display"),
    );
  }

  private async snapshot(slug: string) {
    const [row] = await this.database.getClient().$queryRaw<
      {
        id: string;
        projectId: string;
        templateVersionId: string;
        content: unknown;
        formSchema: RsvpFormSchema;
      }[]
    >`
      SELECT s.id, project.id AS "projectId", project.template_version_id AS "templateVersionId",
        s.content, s.form_schema::text AS "formSchema"
      ${activePublicationBySlug(slug)}
    `;
    if (!row) throw invitationUnavailable();
    try {
      if (row.templateVersionId !== "wedding-garden-v1")
        throw new Error("Unknown template");
      return {
        id: row.id,
        projectId: row.projectId,
        templateVersionId: row.templateVersionId,
        content: validateGardenContent(row.content),
        formSchema: row.formSchema,
      } as const;
    } catch {
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Не удалось прочитать приглашение",
      );
    }
  }

  private async findCover(projectId: string, photoId: string | null) {
    if (!photoId) return null;
    const photo = await this.database.getClient().projectPhoto.findFirst({
      where: { id: photoId, projectId, status: "READY" },
      select: {
        id: true,
        renditionToken: true,
        renderWidth: true,
        renderHeight: true,
      },
    });
    if (!photo?.renditionToken || !photo.renderWidth || !photo.renderHeight)
      return null;
    return {
      id: photo.id,
      token: photo.renditionToken,
      width: photo.renderWidth,
      height: photo.renderHeight,
    };
  }
}
