import { isProjectId } from "@shared/config/project-navigation";

export function rsvpDashboardOperation(
  path: string,
): "list" | "export" | "delete" | undefined {
  const [route, search, ...extra] = path.split("?");
  if (
    extra.length ||
    (search !== undefined && !/^attendance=(yes|no)$/.test(search))
  )
    return undefined;
  const match =
    /^\/api\/v1\/(?:projects|admin\/requests)\/([^/]+)\/responses(?:\/([^/]+))?$/.exec(
      route,
    );
  if (!match || !isProjectId(match[1])) return undefined;
  const tail = match[2];
  if (!tail) return "list";
  if (search !== undefined) return undefined;
  if (tail === "export") return "export";
  return isProjectId(tail) ? "delete" : undefined;
}
