import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { TemplatesModule } from "../templates/templates.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ProjectAccessService } from "./project-access.service";

@Module({
  imports: [DatabaseModule, IdentityModule, TemplatesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessService],
  exports: [ProjectAccessService],
})
export class ProjectsModule {}
