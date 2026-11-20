import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { TemplatesModule } from "./modules/templates/templates.module";

@Module({
  imports: [IdentityModule, TemplatesModule],
  controllers: [HealthController],
})
export class AppModule {}
