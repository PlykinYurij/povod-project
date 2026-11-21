import { isProjectId } from "@shared/config/project-navigation";

const ROOT = "/api/v1/admin/requests";

export function isAdminRequestPath(path: string): boolean {
  const [resource, query, ...extra] = path.split("?");
  if (extra.length > 0) return false;
  if (resource === ROOT) {
    if (query === undefined) return true;
    const fields = [...new URLSearchParams(query)];
    const item = fields[0];
    return fields.length === 1 && item[0] === "after" && isProjectId(item[1]);
  }
  return (
    query === undefined &&
    resource.startsWith(ROOT + "/") &&
    isProjectId(resource.slice(ROOT.length + 1))
  );
}
