import { Module } from "@nestjs/common";
import { TemplateCatalogController } from "./template-catalog.controller";
import { TemplateCatalogService } from "./template-catalog.service";
import { GardenTemplateService } from "./garden/garden-template.service";

@Module({
  controllers: [TemplateCatalogController],
  providers: [TemplateCatalogService, GardenTemplateService],
  exports: [GardenTemplateService],
})
export class TemplatesModule {}
