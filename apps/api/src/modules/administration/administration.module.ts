import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { TemplatesModule } from "../templates/templates.module";
import { AssistedProjectsService } from "./assisted-projects.service";
import { AssistedProjectsController } from "./assisted-projects.controller";
import { AdministrationController } from "./administration.controller";
import { AdminGuard } from "./admin.guard";
import { AdminRequestsController } from "./admin-requests.controller";
import { AdminRequestsService } from "./admin-requests.service";

@Module({
  imports: [DatabaseModule, IdentityModule, TemplatesModule],
  controllers: [
    AdministrationController,
    AdminRequestsController,
    AssistedProjectsController,
  ],
  providers: [AdminGuard, AdminRequestsService, AssistedProjectsService],
  exports: [AdminGuard, AssistedProjectsService],
})
export class AdministrationModule {}
