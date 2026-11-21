import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { AdministrationModule } from "./modules/administration/administration.module";
import { RequestsModule } from "./modules/requests/requests.module";
import { MediaModule } from "./modules/media/media.module";

@Module({
  imports: [
    IdentityModule,
    TemplatesModule,
    ProjectsModule,
    AdministrationModule,
    RequestsModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
