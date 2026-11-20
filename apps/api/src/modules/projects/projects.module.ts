import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { TemplatesModule } from "../templates/templates.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [DatabaseModule, IdentityModule, TemplatesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
