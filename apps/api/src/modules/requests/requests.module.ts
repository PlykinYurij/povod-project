import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import { RequestClock } from "./request-clock";
import { RequestRateService } from "./request-rate.service";
import { ServiceRequestsController } from "./service-requests.controller";
import { ServiceRequestsService } from "./service-requests.service";
import { IdentityModule } from "../identity/identity.module";
import { ProjectsModule } from "../projects/projects.module";
import { TemplatesModule } from "../templates/templates.module";
import { PublicationRequestsController } from "./publication-requests.controller";
import { PublicationRequestsService } from "./publication-requests.service";

@Module({
  imports: [DatabaseModule, IdentityModule, ProjectsModule, TemplatesModule],
  controllers: [ServiceRequestsController, PublicationRequestsController],
  providers: [
    JsonOriginGuard,
    RequestClock,
    RequestRateService,
    ServiceRequestsService,
    PublicationRequestsService,
  ],
})
export class RequestsModule {}
