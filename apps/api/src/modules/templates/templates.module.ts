import { Module } from "@nestjs/common";
import { TemplateCatalogController } from "./template-catalog.controller";
import { TemplateCatalogService } from "./template-catalog.service";
import { GardenTemplateService } from "./garden/garden-template.service";
import { DatabaseModule } from "../../database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [TemplateCatalogController],
  providers: [TemplateCatalogService, GardenTemplateService],
  exports: [GardenTemplateService, TemplateCatalogService],
})
export class TemplatesModule {}
