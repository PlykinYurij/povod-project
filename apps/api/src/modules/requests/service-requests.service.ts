import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { ApiError } from "../../http/api-error";
import type { CreateServiceRequestDto } from "./service-request.dto";
import { RequestClock } from "./request-clock";
import { RequestRateService } from "./request-rate.service";
import { assistanceKeyHash, requestPayloadHash } from "./request-digests";
import {
  acceptedRequest,
  limitedRequest,
  type RequestSubmissionResult,
} from "./request-submission";

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
  ): Promise<RequestSubmissionResult> {
    const keyHash = assistanceKeyHash(key);
    const payloadHash = requestPayloadHash([
      input.contactName,
      input.phone,
      input.contactChannel,
      input.contactValue,
      input.privacyConsent,
    ]);
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
          return acceptedRequest(previous, true);
        }
        const now = this.clock.now();
        const deniedUntil = await this.rate.reserve(tx, ip, input.phone, now);
        if (deniedUntil) return limitedRequest(deniedUntil, now);
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
        return acceptedRequest(row, false);
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
