import { isProjectId } from "@shared/config/project-navigation";

export function isPrivatePhotoImagePath(path: string): boolean {
  const match = /^(.*)\/([^/]+)\/image$/.exec(path);
  return !!match && isPrivatePhotoPath(match[1]) && isProjectId(match[2]);
}

export function isPrivatePhotoPath(path: string): boolean {
  const parts = path.split("/");
  if (parts[0] !== "" || parts[1] !== "api" || parts[2] !== "v1") return false;
  if (parts.length === 6)
    return (
      parts[3] === "projects" && isProjectId(parts[4]) && parts[5] === "photos"
    );
  return (
    parts.length === 8 &&
    parts[3] === "admin" &&
    parts[4] === "requests" &&
    isProjectId(parts[5]) &&
    parts[6] === "project" &&
    parts[7] === "photos"
  );
}
