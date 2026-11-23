import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { ApiErrorDto } from "../../http/api-error";
import { rejectUnknownQuery } from "../../http/request-contract";
import { invitationUnavailable } from "./active-publication";
import { GuestPublicationDto } from "./guest-publication.dto";
import { GuestPublicationService } from "./guest-publication.service";
import { PUBLICATION_SLUG } from "./publication-address";

@ApiTags("publication")
@ApiParam({
  name: "slug",
  schema: { type: "string", pattern: PUBLICATION_SLUG.source },
})
@ApiResponse({ status: 404, type: ApiErrorDto })
@ApiResponse({ status: 422, type: ApiErrorDto })
@ApiResponse({ status: 503, type: ApiErrorDto })
@Controller("api/v1/public/invitations/by-address/:slug")
export class GuestPublicationController {
  constructor(private readonly publications: GuestPublicationService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getGuestPublication" })
  @ApiResponse({ status: 200, type: GuestPublicationDto })
  get(@Param("slug") slug: string, @Query() query: Record<string, unknown>) {
    rejectUnknownQuery(query);
    if (!PUBLICATION_SLUG.test(slug)) throw invitationUnavailable();
    return this.publications.get(slug);
  }

  @Get("cover/:snapshotId")
  @Header("Cache-Control", "no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiParam({ name: "snapshotId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ operationId: "getGuestPublicationCover" })
  @ApiResponse({
    status: 200,
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  async cover(
    @Param("slug") slug: string,
    @Param("snapshotId") snapshotId: string,
    @Query() query: Record<string, unknown>,
  ) {
    rejectUnknownQuery(query);
    if (!PUBLICATION_SLUG.test(slug) || !isUUID(snapshotId))
      throw invitationUnavailable();
    const bytes = await this.publications.cover(slug, snapshotId);
    return new StreamableFile(bytes, {
      type: "image/webp",
      length: bytes.length,
    });
  }
}
