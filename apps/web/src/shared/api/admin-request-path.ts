import { isProjectId } from "@shared/config/project-navigation";

const ROOT = "/api/v1/admin/requests";
const PROJECTS = "/api/v1/admin/projects/";

export function isAdminProjectUnpublishPath(path: string): boolean {
  return isAdminProjectActionPath(path, "/unpublish");
}

export function isAdminProjectResumePath(path: string): boolean {
  return isAdminProjectActionPath(path, "/resume");
}

function isAdminProjectActionPath(path: string, action: string): boolean {
  return (
    path.startsWith(PROJECTS) &&
    path.endsWith(action) &&
    isProjectId(path.slice(PROJECTS.length, -action.length))
  );
}

export function assistedProjectMethod(
  path: string,
): "POST" | "PATCH" | undefined {
  const [id, resource, action, ...extra] = path.startsWith(ROOT + "/")
    ? path.slice(ROOT.length + 1).split("/")
    : [];
  if (!id || !isProjectId(id) || resource !== "project" || extra.length > 0)
    return undefined;
  if (action === undefined) return "POST";
  return action === "draft" ? "PATCH" : undefined;
}

export function isAdminRequestStatusPath(path: string): boolean {
  return (
    path.startsWith(ROOT + "/") &&
    path.endsWith("/status") &&
    isProjectId(path.slice(ROOT.length + 1, -"/status".length))
  );
}

export function isAdminRequestPublishPath(path: string): boolean {
  return (
    path.startsWith(ROOT + "/") &&
    path.endsWith("/publish") &&
    isProjectId(path.slice(ROOT.length + 1, -"/publish".length))
  );
}

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
