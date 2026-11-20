import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import type {
  CreateServiceRequestDto,
  ServiceRequestReceiptDto,
} from "./service-request.dto";
import { RequestClock } from "./request-clock";
import { RequestRateService } from "./request-rate.service";
import { assistanceKeyHash } from "./request-digests";

type SubmitResult =
  | { kind: "accepted"; receipt: ServiceRequestReceiptDto; replay: boolean }
  | { kind: "rate-limited"; retryAfterSeconds: number };
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function accepted(
  row: { id: string; createdAt: Date },
  replay: boolean,
): SubmitResult {
  return {
    kind: "accepted",
    replay,
    receipt: {
      requestId: row.id,
      status: "RECEIVED",
      createdAt: row.createdAt.toISOString(),
    },
  };
}

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: RequestClock,
    private readonly rate: RequestRateService,
  ) {}

  async create(
    input: CreateServiceRequestDto,
    key: string,
    ip: string,
  ): Promise<SubmitResult> {
    const keyHash = assistanceKeyHash(key);
    const payloadHash = hash(
      JSON.stringify([
        input.contactName,
        input.phone,
        input.contactChannel,
        input.contactValue,
        input.privacyConsent,
      ]),
    );
    return this.database.getClient().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 3))`;
        const previous = await tx.serviceRequest.findUnique({
          where: { creationKeyHash: keyHash },
        });
        if (previous) {
          if (previous.creationPayloadHash !== payloadHash) {
            throw new ApiError(
              409,
              "IDEMPOTENCY_KEY_REUSED",
              "Ключ уже использован для другого запроса",
            );
          }
          return accepted(previous, true);
        }
        const now = this.clock.now();
        const deniedUntil = await this.rate.reserve(tx, ip, input.phone, now);
        if (deniedUntil)
          return {
            kind: "rate-limited",
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((deniedUntil.getTime() - now.getTime()) / 1000),
            ),
          };
        const row = await tx.serviceRequest.create({
          data: {
            kind: "ASSISTANCE",
            customerUserId: null,
            projectId: null,
            contactName: input.contactName,
            phone: input.phone,
            contactChannel: input.contactChannel,
            contactValue: input.contactValue,
            creationKeyHash: keyHash,
            creationPayloadHash: payloadHash,
            consentAt: now,
            consentVersion: "contact-request-v1",
            createdAt: now,
            updatedAt: now,
          },
        });
        return accepted(row, false);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
