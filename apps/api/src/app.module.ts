import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity/identity.module";

@Module({
  imports: [IdentityModule],
  controllers: [HealthController],
})
export class AppModule {}
