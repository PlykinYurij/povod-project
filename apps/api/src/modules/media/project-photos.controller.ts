import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrorDto } from "../../http/api-error";
import {
  readIdempotencyKey,
  rejectUnknownQuery,
} from "../../http/request-contract";
import { AdminGuard } from "../administration/admin.guard";
import {
  AuthenticatedRequest,
  requireActor,
  SessionGuard,
} from "../identity/session.guard";
import { ProjectIdDto } from "../projects/project.dto";
import { PhotoUpload } from "./photo-upload";
import {
  PhotoIdDto,
  ProjectPhotoDto,
  ProjectPhotoListDto,
} from "./project-photos.dto";
import {
  ProjectPhotosService,
  type PhotoScope,
} from "./project-photos.service";

async function privateImage(
  photos: ProjectPhotosService,
  scope: PhotoScope,
  photoId: string,
  query: Record<string, unknown>,
) {
  rejectUnknownQuery(query);
  const bytes = await photos.image(scope, photoId);
  return new StreamableFile(bytes, {
    type: "image/webp",
    length: bytes.length,
  });
}

@ApiTags("photos")
@ApiCookieAuth("session")
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@UseGuards(SessionGuard)
@Controller("api/v1/projects/:id/photos")
export class ProjectPhotosController {
  constructor(private readonly photos: ProjectPhotosService) {}

  @Get(":photoId/image")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ operationId: "getProjectPhotoImage" })
  @ApiResponse({
    status: 200,
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  image(
    @Req() request: AuthenticatedRequest,
    @Param() params: PhotoIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    return privateImage(
      this.photos,
      { kind: "owner", actorId: requireActor(request).id, id: params.id },
      params.photoId,
      query,
    );
  }

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "listProjectPhotos" })
  @ApiResponse({ status: 200, type: ProjectPhotoListDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    return this.photos.list({
      kind: "owner",
      actorId: requireActor(request).id,
      id: params.id,
    });
  }

  @Post()
  @HttpCode(200)
  @PhotoUpload()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "uploadProjectPhoto" })
  @ApiResponse({ status: 200, type: ProjectPhotoDto })
  @ApiResponse({ status: 403, type: ApiErrorDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  @ApiResponse({ status: 413, type: ApiErrorDto })
  @ApiResponse({ status: 415, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({ status: 429, type: ApiErrorDto })
  @ApiResponse({ status: 503, type: ApiErrorDto })
  upload(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    return this.photos.upload(
      { kind: "owner", actorId: requireActor(request).id, id: params.id },
      file,
      readIdempotencyKey(key),
    );
  }
}

@ApiTags("photos")
@ApiCookieAuth("session")
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@UseGuards(SessionGuard, AdminGuard)
@Controller("api/v1/admin/requests/:id/project/photos")
export class AssistedPhotosController {
  constructor(private readonly photos: ProjectPhotosService) {}

  @Get(":photoId/image")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ operationId: "getAssistedPhotoImage" })
  @ApiResponse({
    status: 200,
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  image(
    @Req() request: AuthenticatedRequest,
    @Param() params: PhotoIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    return privateImage(
      this.photos,
      { kind: "assisted", actorId: requireActor(request).id, id: params.id },
      params.photoId,
      query,
    );
  }

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "listAssistedPhotos" })
  @ApiResponse({ status: 200, type: ProjectPhotoListDto })
  list(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    return this.photos.list({
      kind: "assisted",
      actorId: requireActor(request).id,
      id: params.id,
    });
  }

  @Post()
  @HttpCode(200)
  @PhotoUpload()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "uploadAssistedPhoto" })
  @ApiResponse({ status: 200, type: ProjectPhotoDto })
  @ApiResponse({ status: 409, type: ApiErrorDto })
  @ApiResponse({ status: 413, type: ApiErrorDto })
  @ApiResponse({ status: 415, type: ApiErrorDto })
  @ApiResponse({ status: 422, type: ApiErrorDto })
  @ApiResponse({ status: 429, type: ApiErrorDto })
  @ApiResponse({ status: 503, type: ApiErrorDto })
  upload(
    @Req() request: AuthenticatedRequest,
    @Param() params: ProjectIdDto,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Headers("idempotency-key") key: unknown,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    return this.photos.upload(
      { kind: "assisted", actorId: requireActor(request).id, id: params.id },
      file,
      readIdempotencyKey(key),
    );
  }
}
