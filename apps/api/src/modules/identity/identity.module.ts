import { Module } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RegistrationController } from "./registration.controller";
import { RegistrationService } from "./registration.service";
import { RegistrationOriginGuard } from "./registration-origin.guard";
import { ThrottlerModule } from "@nestjs/throttler";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { CsrfService } from "./csrf.service";
import { CsrfGuard } from "./csrf.guard";
import { LoginAttemptsService } from "./login-attempts.service";
import { SessionGuard } from "./session.guard";
import { AuthClock } from "./auth-clock";
import { PasswordResetController } from "./password-reset.controller";
import { PasswordResetService } from "./password-reset.service";
import { ResetMailService } from "./reset-mail.service";
import { ResetRateService } from "./reset-rate.service";
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
  controllers: [RegistrationController, SessionController, PasswordResetController],
  providers: [
    DatabaseService,
    RegistrationService,
    RegistrationOriginGuard,
    RegistrationRateGuard,
    SessionService,
    CsrfService,
    CsrfGuard,
    LoginAttemptsService,
    SessionGuard,
    AuthClock,
    PasswordResetService,
    ResetMailService,
    ResetRateService,
  ],
  exports: [SessionGuard, SessionService],
})
export class IdentityModule {}
