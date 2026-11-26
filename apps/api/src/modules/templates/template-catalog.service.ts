import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import type {
  TemplateCatalogDto,
  TemplateCatalogQueryDto,
  TemplatePriceDto,
} from "./template-catalog.dto";
import { templateMetadata, registeredTemplate } from "./template-definitions";
import { templatePrice } from "./template-price";

@Injectable()
export class TemplateCatalogService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: TemplateCatalogQueryDto): Promise<TemplateCatalogDto> {
    const locale = query.locale ?? "ru";
    const db = this.database.getClient();
    // One DB snapshot keeps categories, availability and price fields consistent.
    const [categories, versions] = await db.$transaction(
      [
        db.templateCategory.findMany({
          where: { active: true },
          orderBy: { id: "asc" },
        }),
        db.templateVersion.findMany({
          where: {
            availableForNewProjects: true,
            template: {
              active: true,
              category: { active: true },
              ...(query.category ? { categoryId: query.category } : {}),
            },
          },
          include: { template: true },
          orderBy: [{ templateId: "asc" }, { id: "asc" }],
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      categories: categories.map((category) => ({
        id: category.id,
        title: locale === "ru" ? category.titleRu : category.titleEn,
      })),
      items: versions.filter(registeredTemplate).map((version) => ({
        templateVersionId: version.id,
        templateId: version.templateId,
        categoryId: version.template.categoryId,
        title:
          locale === "ru" ? version.template.titleRu : version.template.titleEn,
        schemaVersion: version.schemaVersion,
        price: templatePrice(version.template),
        ...templateMetadata(version.id, locale),
      })),
    };
  }

  async assertAvailableForCreation(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    // Share locks protect the check through creation; an operator update waits for commit.
    const versions = await tx.$queryRaw<
      {
        id: string;
        templateId: string;
        schemaVersion: number;
        rendererKey: string;
        defaultsVersion: number;
        available: boolean;
        templateActive: boolean;
        categoryActive: boolean;
      }[]
    >`SELECT v.id, v.template_id AS "templateId", v.schema_version AS "schemaVersion",
       v.renderer_key AS "rendererKey", v.defaults_version AS "defaultsVersion",
       v.available_for_new_projects AS available, t.active AS "templateActive", c.active AS "categoryActive"
       FROM template_versions v JOIN templates t ON t.id = v.template_id
       JOIN template_categories c ON c.id = t.category_id WHERE v.id = ${id}
       FOR SHARE OF c, t, v`;
    const version = versions[0];
    if (
      !version ||
      !version.available ||
      !version.templateActive ||
      !version.categoryActive ||
      !registeredTemplate(version)
    ) {
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Шаблон не найден");
    }
  }

  async lockProjectPrice(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<TemplatePriceDto | null> {
    // Retired designs remain usable by existing projects. The quote needs a stable price, not catalog visibility.
    const rows = await tx.$queryRaw<
      {
        id: string;
        templateId: string;
        schemaVersion: number;
        rendererKey: string;
        defaultsVersion: number;
        priceMinor: number | null;
        priceVersion: number;
        currency: string;
      }[]
    >`SELECT v.id, v.template_id AS "templateId", v.schema_version AS "schemaVersion",
      v.renderer_key AS "rendererKey", v.defaults_version AS "defaultsVersion",
      t.price_minor AS "priceMinor", t.price_version AS "priceVersion", t.currency
      FROM template_versions v JOIN templates t ON t.id = v.template_id
      WHERE v.id = ${id} FOR SHARE OF t, v`;
    const row = rows[0];
    if (!row || !registeredTemplate(row) || row.currency !== "RUB") {
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Версия шаблона недоступна",
      );
    }
    return templatePrice(row);
  }

  async projectPrice(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<TemplatePriceDto | null> {
    const version = await tx.templateVersion.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!version || !registeredTemplate(version))
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Версия шаблона недоступна",
      );
    return templatePrice(version.template);
  }
}
