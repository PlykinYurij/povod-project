import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { RsvpController } from "./rsvp.controller";
import { RsvpRateService } from "./rsvp-rate.service";
import { RsvpService } from "./rsvp.service";

@Module({
  imports: [DatabaseModule],
  controllers: [RsvpController],
  providers: [RsvpService, RsvpRateService],
})
export class RsvpModule {}
