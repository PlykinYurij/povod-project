import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AdministrationModule } from "../administration/administration.module";
import { IdentityModule } from "../identity/identity.module";
import { MediaModule } from "../media/media.module";
import { GuestPublicationController } from "./guest-publication.controller";
import { GuestPublicationService } from "./guest-publication.service";
import { PublishRequestController } from "./publish-request.controller";
import { PublishRequestService } from "./publish-request.service";
import { UnpublishProjectController } from "./unpublish-project.controller";
import { UnpublishProjectService } from "./unpublish-project.service";

@Module({
  imports: [DatabaseModule, AdministrationModule, IdentityModule, MediaModule],
  controllers: [PublishRequestController, GuestPublicationController, UnpublishProjectController],
  providers: [PublishRequestService, GuestPublicationService, UnpublishProjectService],
})
export class PublicationModule {}
