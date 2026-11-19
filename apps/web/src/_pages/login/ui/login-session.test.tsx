// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { LoginSession } from "./login-session";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const harness = setupIdentityTest();
const { show } = harness;
const calls: { path: string; body: Record<string, unknown> }[] = [];
let sessionStatus = 200;
beforeEach(() => {
  calls.length = 0;
  sessionStatus = 200;
  router.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      const body: Record<string, unknown> = options?.body
        ? JSON.parse(String(options.body))
        : {};
      calls.push({ path, body });
      if (path.endsWith("/csrf"))
        return Response.json({ csrfToken: "synthetic" });
      if (path.endsWith("/logout")) return new Response(null, { status: 204 });
      if (path.endsWith("/session")) {
        if (sessionStatus === 200)
          return Response.json({
            user: {
              id: "synthetic",
              email: "owner@example.test",
              userName: "Анна",
            },
          });
        return Response.json(
          {
            error: {
              code:
                sessionStatus === 401
                  ? "UNAUTHENTICATED"
                  : "SERVICE_UNAVAILABLE",
            },
          },
          { status: sessionStatus },
        );
      }
      throw new Error("Unexpected API request in test: " + path);
    }),
  );
});
test("authenticated login redirects without rendering another sign-in form", async () => {
  show(<LoginSession returnTo="/account?tab=projects" />);
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/account?tab=projects"),
  );
  expect(screen.queryByLabelText(ru.Auth.email, { exact: false })).toBeNull();
});

test("only confirmed 401 exposes the sign-in form", async () => {
  sessionStatus = 401;
  show(<LoginSession returnTo="/account" />);
  await screen.findByLabelText(ru.Auth.email, { exact: false });
  expect(router.replace).not.toHaveBeenCalled();
});

test("service failure keeps retry visible instead of pretending the owner signed out", async () => {
  sessionStatus = 503;
  show(<LoginSession returnTo="/account" />);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText(ru.Auth.email, { exact: false })).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  sessionStatus = 401;
  await userEvent.click(screen.getByRole("button", { name: ru.Common.retry }));
  await screen.findByLabelText(ru.Auth.email, { exact: false });
});
