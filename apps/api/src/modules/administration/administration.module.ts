import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { AdministrationController } from "./administration.controller";
import { AdminGuard } from "./admin.guard";
import { AdminRequestsController } from "./admin-requests.controller";
import { AdminRequestsService } from "./admin-requests.service";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AdministrationController, AdminRequestsController],
  providers: [AdminGuard, AdminRequestsService],
  exports: [AdminGuard],
})
export class AdministrationModule {}
