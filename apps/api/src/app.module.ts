import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { ProjectsModule } from "./modules/projects/projects.module";

@Module({
  imports: [IdentityModule, TemplatesModule, ProjectsModule],
  controllers: [HealthController],
})
export class AppModule {}
