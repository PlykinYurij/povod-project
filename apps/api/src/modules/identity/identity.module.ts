import { Module } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RegistrationController } from "./registration.controller";
import { RegistrationService } from "./registration.service";
import { RegistrationOriginGuard } from "./registration-origin.guard";
import { ThrottlerModule } from "@nestjs/throttler";
import {
  RegistrationRateGuard,
  registrationLimit,
} from "./registration-rate.guard";

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => [{ ttl: 15 * 60 * 1000, limit: registrationLimit() }],
    }),
  ],
  controllers: [RegistrationController],
  providers: [
    DatabaseService,
    RegistrationService,
    RegistrationOriginGuard,
    RegistrationRateGuard,
  ],
})
export class IdentityModule {}
