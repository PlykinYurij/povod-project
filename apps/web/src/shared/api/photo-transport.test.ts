import { afterEach, expect, test, vi } from "vitest";
import { uploadProjectPhoto } from "./generated/http";
import { apiFetch } from "./transport";

const project = "f729d400-0942-4633-9bc7-f33ffe78c422";

afterEach(() => vi.unstubAllGlobals());

test("Orval keeps the multipart boundary browser managed and the request private", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      id: project,
      status: "PROCESSING",
      width: 24,
      height: 16,
      byteSize: 120,
      createdAt: "2026-11-21T00:00:00.000Z",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const file = new Blob(["image"]);
  await uploadProjectPhoto(
    project,
    { file },
    {
      headers: {
        "X-CSRF-Token": "synthetic",
        "Idempotency-Key": project,
        "Content-Type": "multipart/form-data",
      },
    },
  );
  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain(`/api/v1/projects/${project}/photos`);
  expect(options.credentials).toBe("include");
  expect(options.cache).toBe("no-store");
  expect(options.headers.has("Content-Type")).toBe(false);
  expect(options.headers.get("Idempotency-Key")).toBe(project);
  expect(options.body).toBeInstanceOf(FormData);
  expect(await options.body.get("file").text()).toBe("image");
});

test("photo mutations refuse JSON and extra paths or query parameters", async () => {
  const path = `/api/v1/projects/${project}/photos`;
  await expect(apiFetch(path, { method: "POST", body: "{}" })).rejects.toThrow(
    "Photos require FormData",
  );
  await expect(apiFetch(path + "?include=keys")).rejects.toThrow(
    "Untrusted API path",
  );
  await expect(apiFetch(path + "/original")).rejects.toThrow(
    "Untrusted API path",
  );
});
