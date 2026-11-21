import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { AdministrationModule } from "../administration/administration.module";
import { IdentityModule } from "../identity/identity.module";
import { ProjectsModule } from "../projects/projects.module";
import { PhotoStorage } from "./photo-storage";
import { PhotoOriginGuard, PhotoUploadInterceptor } from "./photo-upload";
import {
  AssistedPhotosController,
  ProjectPhotosController,
} from "./project-photos.controller";
import { ProjectPhotosService } from "./project-photos.service";

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    ProjectsModule,
    AdministrationModule,
  ],
  controllers: [AssistedPhotosController, ProjectPhotosController],
  providers: [
    PhotoOriginGuard,
    PhotoUploadInterceptor,
    PhotoStorage,
    ProjectPhotosService,
  ],
})
export class MediaModule {}
