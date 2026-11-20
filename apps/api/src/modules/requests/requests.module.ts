import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { JsonOriginGuard } from "../../http/json-origin.guard";
import { RequestClock } from "./request-clock";
import { RequestRateService } from "./request-rate.service";
import { ServiceRequestsController } from "./service-requests.controller";
import { ServiceRequestsService } from "./service-requests.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceRequestsController],
  providers: [
    JsonOriginGuard,
    RequestClock,
    RequestRateService,
    ServiceRequestsService,
  ],
})
export class RequestsModule {}
