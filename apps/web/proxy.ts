import { NextResponse, type NextRequest } from "next/server";
import { publicationSurface } from "@shared/config/publication-host";
import { isProjectId } from "@shared/config/project-navigation";

const noStore = "no-store";
const robots = "noindex, nofollow";

export function proxy(request: NextRequest) {
  const surface = publicationSurface(request.headers.get("host"));
  const path = request.nextUrl.pathname;
  if (surface.kind === "platform") return NextResponse.next();
  const method = request.method;
  if (surface.kind === "guest" && method === "POST" && path === "/rsvp")
    return NextResponse.next();
  if (surface.kind === "guest" && (method === "GET" || method === "HEAD")) {
    if (path.startsWith("/_next/static/")) return NextResponse.next();
    if (
      path === "/" ||
      (path.startsWith("/cover/") && isProjectId(path.slice(7)))
    ) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", noStore);
      response.headers.set("X-Robots-Tag", robots);
      return response;
    }
  }
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": noStore, "X-Robots-Tag": robots },
  });
}
