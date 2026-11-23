import { PUBLICATION_SLUG } from "@shared/config/publication-host";
import { isProjectId } from "@shared/config/project-navigation";

const ROOT = "/api/v1/public/invitations/by-address/";

export function guestPublicationKind(
  path: string,
): "page" | "cover" | undefined {
  if (!path.startsWith(ROOT)) return undefined;
  const [slug, cover, id, ...extra] = path.slice(ROOT.length).split("/");
  if (!PUBLICATION_SLUG.test(slug) || extra.length) return undefined;
  if (cover === undefined) return "page";
  if (cover === "cover" && isProjectId(id)) return "cover";
  return undefined;
}
