import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import { projectResponse } from "../projects/project-mapping";
import { readRequestPrice } from "../requests/request-price";
import type {
  AdminRequestDetailDto,
  AdminRequestPageDto,
  AdminRequestSummaryDto,
} from "./admin-requests.dto";

const PAGE_SIZE = 30;
const summaryFields = {
  id: true,
  kind: true,
  status: true,
  createdAt: true,
  project: {
    select: {
      title: true,
      deletedAt: true,
      templateVersion: { select: { templateId: true } },
    },
  },
  customer: { select: { userName: true } },
} satisfies Prisma.ServiceRequestSelect;

type SummaryRow = Prisma.ServiceRequestGetPayload<{
  select: typeof summaryFields;
}>;

function summary(row: SummaryRow): AdminRequestSummaryDto {
  const project =
    row.project && row.project.deletedAt === null ? row.project : null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    templateId: project?.templateVersion.templateId ?? null,
    projectTitle: project?.title ?? null,
    userName: row.customer?.userName ?? null,
    hasAccount: row.customer !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminRequestsService {
  constructor(private readonly database: DatabaseService) {}

  async list(after: string | undefined): Promise<AdminRequestPageDto> {
    const rows = await this.database.getClient().serviceRequest.findMany({
      select: summaryFields,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map(summary),
      next: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async detail(id: string): Promise<AdminRequestDetailDto> {
    const row = await this.database.getClient().serviceRequest.findUnique({
      where: { id },
      select: {
        ...summaryFields,
        contactName: true,
        phone: true,
        contactChannel: true,
        contactValue: true,
        submittedRevision: true,
        priceSnapshotMinor: true,
        priceSnapshotCurrency: true,
        priceSnapshotVersion: true,
        project: {
          include: { templateVersion: { select: { templateId: true } } },
        },
      },
    });
    if (!row) throw new ApiError(404, "REQUEST_NOT_FOUND", "Заявка не найдена");
    return {
      ...summary(row),
      contactName: row.contactName,
      phone: row.phone,
      contactChannel: row.contactChannel,
      contactValue: row.contactValue,
      submittedRevision: row.submittedRevision,
      quotedPrice: readRequestPrice(row),
      project:
        row.project && row.project.deletedAt === null
          ? projectResponse(row.project)
          : null,
    };
  }
}
