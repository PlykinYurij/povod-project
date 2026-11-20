import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../database/generated/client";
import { ApiError } from "../../http/api-error";
import type {
  TemplateCatalogDto,
  TemplateCatalogQueryDto,
} from "./template-catalog.dto";
import { gardenMetadata, registeredTemplate } from "./template-definitions";

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
        price:
          version.template.priceMinor === null
            ? null
            : {
                amountMinor: version.template.priceMinor,
                currency: "RUB",
                version: version.template.priceVersion,
              },
        ...gardenMetadata(locale),
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
}
