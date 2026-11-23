import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AdministrationModule } from "../administration/administration.module";
import { IdentityModule } from "../identity/identity.module";
import { MediaModule } from "../media/media.module";
import { GuestPublicationController } from "./guest-publication.controller";
import { GuestPublicationService } from "./guest-publication.service";
import { PublishRequestController } from "./publish-request.controller";
import { PublishRequestService } from "./publish-request.service";

@Module({
  imports: [DatabaseModule, AdministrationModule, IdentityModule, MediaModule],
  controllers: [PublishRequestController, GuestPublicationController],
  providers: [PublishRequestService, GuestPublicationService],
})
export class PublicationModule {}
