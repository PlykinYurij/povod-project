import { ApiRequestError, getGuestPublicationCover } from "@shared/api/server";
import { publicationSurface } from "@shared/config/publication-host";
import { isProjectId } from "@shared/config/project-navigation";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const surface = publicationSurface(request.headers.get("host"));
  const { snapshotId } = await params;
  if (surface.kind !== "guest" || !isProjectId(snapshotId)) {
    return new Response(null, { status: 404, headers });
  }
  try {
    const photo = await getGuestPublicationCover(surface.slug, snapshotId, {
      signal: AbortSignal.timeout(10_000),
    });
    return new Response(photo, {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch (error) {
    const status =
      error instanceof ApiRequestError && error.status === 404 ? 404 : 503;
    return new Response(null, { status, headers });
  }
}
