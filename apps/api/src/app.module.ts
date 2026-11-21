import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { AdministrationModule } from "./modules/administration/administration.module";
import { RequestsModule } from "./modules/requests/requests.module";

@Module({
  imports: [
    IdentityModule,
    TemplatesModule,
    ProjectsModule,
    AdministrationModule,
    RequestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
