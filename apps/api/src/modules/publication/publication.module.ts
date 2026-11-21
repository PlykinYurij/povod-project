import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AdministrationModule } from "../administration/administration.module";
import { IdentityModule } from "../identity/identity.module";
import { PublishRequestController } from "./publish-request.controller";
import { PublishRequestService } from "./publish-request.service";

@Module({
  imports: [DatabaseModule, AdministrationModule, IdentityModule],
  controllers: [PublishRequestController],
  providers: [PublishRequestService],
})
export class PublicationModule {}
