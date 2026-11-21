import { afterEach, expect, test, vi } from "vitest";
import { getTemplateCatalog } from "./generated/http";
import { templateCatalogFixture } from "@shared/lib/testing/template-catalog-fixture";
import { isPublicCatalogPath } from "./catalog-path";

afterEach(() => vi.unstubAllGlobals());

test.each([
  "/api/v1/templates",
  "/api/v1/templates?category=wedding&locale=ru",
  "/api/v1/templates?locale=en&category=birthday",
])("supported public catalog URL: %s", (path) => {
  expect(isPublicCatalogPath(path)).toBe(true);
});

test.each([
  "/api/v1/templates?category=",
  "/api/v1/templates?category=wedding&category=birthday",
  "/api/v1/templates?category=wedding&ownerId=private",
  "/api/v1/templates?locale=ru&locale=en",
  "/api/v1/templates?category=..%2Fprivate",
  "/api/v1/templates?category=" + "a".repeat(65),
  "/api/v1/templates/../auth/session",
])(
  "unsupported catalog URL stays outside the credential boundary: %s",
  (path) => {
    expect(isPublicCatalogPath(path)).toBe(false);
  },
);

test("generated category filter cannot forward account credentials", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json(templateCatalogFixture()));
  vi.stubGlobal("fetch", fetch);
  await getTemplateCatalog(
    { category: "wedding", locale: "en" },
    {
      headers: {
        Cookie: "synthetic",
        Authorization: "Bearer synthetic",
        "X-CSRF-Token": "synthetic",
      },
    },
  );
  const [requestUrl, options] = fetch.mock.calls[0];
  expect(new URL(requestUrl).searchParams.get("category")).toBe("wedding");
  expect(new URL(requestUrl).searchParams.get("locale")).toBe("en");
  expect(options.credentials).toBe("omit");
  for (const header of ["Cookie", "Authorization", "X-CSRF-Token"])
    expect(options.headers.has(header)).toBe(false);
});
