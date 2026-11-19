// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import ru from "@shared/i18n/ru.json";
import { AccountSession } from "./account-session";

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
test("expired account redirects to login with a safe return address", async () => {
  sessionStatus = 401;
  window.history.replaceState(null, "", "/account?tab=projects#drafts");
  show(<AccountSession />);
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(
      "/login?returnTo=%2Faccount%3Ftab%3Dprojects%23drafts",
    ),
  );
  expect(screen.queryByText(ru.Account.empty)).toBeNull();
});

test("account uses userName and successful logout clears the private cache", async () => {
  show(<AccountSession />);
  await screen.findByText(ru.Account.greeting.replace("{name}", "Анна"));
  harness.client.setQueryData(["private", "owner"], "private data");
  await userEvent.click(screen.getByRole("button", { name: ru.Auth.logout }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(harness.client.getQueryData(["private", "owner"])).toBeUndefined();
  expect(calls.filter((call) => call.path.endsWith("/logout"))).toHaveLength(1);
});
