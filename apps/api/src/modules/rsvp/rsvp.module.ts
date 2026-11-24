import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AdministrationModule } from "../administration/administration.module";
import { IdentityModule } from "../identity/identity.module";
import { RsvpDashboardController } from "./rsvp-dashboard.controller";
import { RsvpDashboardService } from "./rsvp-dashboard.service";
import { RsvpDeletionService } from "./rsvp-deletion.service";
import { RsvpController } from "./rsvp.controller";
import { RsvpRateService } from "./rsvp-rate.service";
import { RsvpService } from "./rsvp.service";

@Module({
  imports: [DatabaseModule, IdentityModule, AdministrationModule],
  controllers: [RsvpController, RsvpDashboardController],
  providers: [
    RsvpService,
    RsvpRateService,
    RsvpDashboardService,
    RsvpDeletionService,
  ],
})
export class RsvpModule {}
