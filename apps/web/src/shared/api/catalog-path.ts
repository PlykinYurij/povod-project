/** Recognize only supported public catalog queries before stripping credentials. */
export function isPublicCatalogPath(path: string): boolean {
  const [base, query, ...extra] = path.split("?");
  if (base !== "/api/v1/templates" || extra.length > 0) return false;
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (
      !["locale", "category"].includes(key) ||
      params.getAll(key).length !== 1
    )
      return false;
  }
  if (params.has("locale") && !["ru", "en"].includes(params.get("locale")!))
    return false;
  const category = params.get("category");
  if (
    category !== null &&
    (category.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category))
  )
    return false;
  return true;
}
