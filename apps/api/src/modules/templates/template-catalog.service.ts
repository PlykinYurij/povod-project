import { Injectable } from "@nestjs/common";
import type {
  TemplateCatalogDto,
  TemplateCatalogQueryDto,
} from "./template-catalog.dto";

const titles = {
  ru: { template: "Тихий сад", sage: "Шалфей", sand: "Тёплый песок" },
  en: { template: "Quiet Garden", sage: "Sage", sand: "Warm sand" },
};

@Injectable()
export class TemplateCatalogService {
  list(locale: TemplateCatalogQueryDto["locale"] = "ru"): TemplateCatalogDto {
    const text = titles[locale];
    // Code-owned metadata only. User projects, snapshots, keys and account data never enter this registry.
    return {
      items: [
        {
          templateVersionId: "wedding-garden-v1",
          title: text.template,
          eventType: "wedding",
          schemaVersion: 1,
          themes: [
            { id: "sage", title: text.sage },
            { id: "sand", title: text.sand },
          ],
          blocks: [
            { id: "names", required: true },
            { id: "event", required: true },
            { id: "venue", required: true },
            { id: "photo", required: false },
            { id: "program", required: false },
            { id: "rsvp", required: true },
          ],
          demoPath: "/templates/quiet-garden",
          previewImagePath: "/templates/quiet-garden/garden.svg",
        },
      ],
    };
  }
}
