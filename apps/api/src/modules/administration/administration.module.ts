import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { AdministrationController } from "./administration.controller";
import { AdminGuard } from "./admin.guard";

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AdministrationController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdministrationModule {}
