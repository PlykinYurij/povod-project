import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import { lockPublishedProject, readActiveRsvpForm } from "./active-publication";
import type {
  PublicRsvpFormDto,
  RsvpReceiptDto,
  SubmitRsvpDto,
} from "./rsvp.dto";
import { describeRsvpForm } from "./rsvp-form";
import { RsvpRateService } from "./rsvp-rate.service";

const RESPONSE_LIMIT = 300;

@Injectable()
export class RsvpService {
  constructor(
    private readonly database: DatabaseService,
    private readonly rate: RsvpRateService,
  ) {}

  async getForm(slug: string): Promise<PublicRsvpFormDto> {
    const form = await readActiveRsvpForm(this.database.getClient(), slug);
    return describeRsvpForm(form.formVersionId, form.formSchema);
  }

  async submit(
    slug: string,
    input: SubmitRsvpDto,
    key: string,
    ip: string,
  ): Promise<
    { receipt: RsvpReceiptDto; replay: boolean } | { retryAfter: number }
  > {
    if (input.attendance === "no" && input.companions !== 0) {
      throw new ApiError(422, "VALIDATION_FAILED", "Проверьте поля", [
        { path: "companions", code: "INVALID_VALUE" },
      ]);
    }
    const keyHash = createHash("sha256")
      .update(key.toLowerCase())
      .digest("hex");
    const formVersionId = input.formVersionId.toLowerCase();
    return this.database.getClient().$transaction(
      async (tx) => {
        await lockPublishedProject(tx, slug);
        const form = await readActiveRsvpForm(tx, slug);
        const { publicationId } = form;
        const previous = await tx.rsvpResponse.findUnique({
          where: { publicationId_keyHash: { publicationId, keyHash } },
        });
        if (previous) {
          if (
            previous.formVersionId !== formVersionId ||
            previous.name !== input.name ||
            previous.attendance !== input.attendance ||
            previous.companions !== input.companions
          ) {
            throw new ApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "Ключ уже использован для другого ответа",
            );
          }
          return { receipt: receipt(previous), replay: true };
        }
        if (form.formVersionId !== formVersionId) {
          throw new ApiError(
            409,
            "RSVP_FORM_CHANGED",
            "Откройте актуальную анкету",
          );
        }
        if (
          (await tx.rsvpResponse.count({ where: { publicationId } })) >=
          RESPONSE_LIMIT
        ) {
          throw new ApiError(
            409,
            "RSVP_LIMIT_REACHED",
            "Приём ответов завершён",
          );
        }
        const retryAfter = await this.rate.reserve(tx, publicationId, ip);
        if (retryAfter) return { retryAfter };

        const row = await tx.rsvpResponse.create({
          data: {
            publicationId,
            formVersionId,
            keyHash,
            name: input.name,
            attendance: input.attendance,
            companions: input.companions,
          },
        });
        return { receipt: receipt(row), replay: false };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}

function receipt(row: { id: string; createdAt: Date }): RsvpReceiptDto {
  return { responseId: row.id, receivedAt: row.createdAt.toISOString() };
}
