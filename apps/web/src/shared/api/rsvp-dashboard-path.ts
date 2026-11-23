import { isProjectId } from "@shared/config/project-navigation";

export function isRsvpDashboardPath(path: string): boolean {
  const [route, search, ...extra] = path.split("?");
  if (
    extra.length ||
    (search !== undefined && !/^attendance=(yes|no)$/.test(search))
  )
    return false;
  const match =
    /^\/api\/v1\/(?:projects|admin\/requests)\/([^/]+)\/responses$/.exec(route);
  return !!match && isProjectId(match[1]);
}
