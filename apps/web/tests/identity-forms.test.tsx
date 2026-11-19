// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { RegistrationForm } from "@features/register";
import { PasswordResetForm } from "@features/password-reset";
import { SignInForm } from "@features/sign-in";
import { LoginSession } from "@pages/login/ui/login-session";
import { AccountSession } from "@pages/account/ui/account-session";
import { getQueryClient } from "@app/query-client";
import ru from "@shared/i18n/ru.json";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const calls: { path: string; body: Record<string, unknown> }[] = [];
let registerStatus = 202;
let sessionStatus = 200;
let client: QueryClient;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
});
beforeEach(() => {
  calls.length = 0;
  registerStatus = 202;
  sessionStatus = 200;
  router.replace.mockReset();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      const body: Record<string, unknown> = options?.body
        ? JSON.parse(String(options.body))
        : {};
      calls.push({ path, body });
      if (path.endsWith("/session") && sessionStatus !== 200) {
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
      if (path.endsWith("/logout")) return new Response(null, { status: 204 });
      if (path.endsWith("/csrf"))
        return Response.json({ csrfToken: "synthetic" });
      if (path.endsWith("/password-reset/confirm"))
        return new Response(null, { status: 204 });
      if (path.endsWith("/password-reset/request"))
        return Response.json({ accepted: true }, { status: 202 });
      if (path.endsWith("/register")) {
        if (registerStatus === 409)
          return Response.json(
            { error: { code: "EMAIL_UNAVAILABLE" } },
            { status: 409 },
          );
        return Response.json(
          {
            registrationId: "d24398d2-409c-4d87-a614-04967b2d705e",
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
          { status: 202 },
        );
      }
      return Response.json({
        user: {
          id: "synthetic",
          email: "owner@example.test",
          userName: "Анна",
        },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

function show(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="ru" messages={ru} timeZone="UTC">
        <MantineProvider env="test">{children}</MantineProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}
function fill(label: string, value: string) {
  fireEvent.change(
    screen.getByLabelText(label, { exact: false, selector: "input" }),
    { target: { value } },
  );
}
function fillRegistration(confirmation = "Abcdef1!") {
  fill(ru.Identity.userName, " Анна ");
  fill(ru.Auth.email, "OWNER@example.test");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, confirmation);
}

test("browser QueryClient survives provider rerenders without becoming a server singleton", () => {
  expect(getQueryClient()).toBe(getQueryClient());
});

test("signup uses inline field errors and never browser validation popups", async () => {
  const { container } = show(<RegistrationForm returnTo="/account" />);
  fill(ru.Auth.email, "test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(container.querySelector("form")?.noValidate).toBe(true);
  expect(screen.getByText(ru.Auth.emailInvalid)).toBeTruthy();
  expect(screen.getByText(ru.Identity.nameInvalid)).toBeTruthy();
  expect(screen.getByText(ru.Identity.passwordMismatch)).toBeTruthy();
  expect(calls).toEqual([]);
});

test("password checklist updates and a mismatch prevents registration", async () => {
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration("Different1!");
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  await waitFor(() =>
    expect(screen.getByText(ru.Identity.passwordMismatch)).toBeTruthy(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(calls).toEqual([]);
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await waitFor(() =>
    expect(screen.queryByText(ru.Identity.passwordMismatch)).toBeNull(),
  );
  fill(ru.Identity.newPassword, "Abc def1!");
  await waitFor(() =>
    expect(
      screen.getByRole("listitem", {
        name: `${ru.Identity.rule_noSpaces}: ${ru.Identity.ruleMissing}`,
      }),
    ).toBeTruthy(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  expect(calls).toEqual([]);
});

test("valid signup sends userName and only API fields, then asks for email code", async () => {
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration();
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  expect(calls.find((call) => call.path.endsWith("/register"))?.body).toEqual({
    email: "owner@example.test",
    userName: "Анна",
    password: "Abcdef1!",
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(
    screen.queryByLabelText(ru.Identity.newPassword, { exact: false }),
  ).toBeNull();
});

test("email conflict is shown under email without a duplicate alert", async () => {
  registerStatus = 409;
  show(<RegistrationForm returnTo="/account" />);
  fillRegistration();
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.register }),
  );
  await screen.findByText(ru.Identity.emailUnavailable);
  expect(
    screen
      .getByLabelText(ru.Auth.email, { exact: false })
      .getAttribute("aria-invalid"),
  ).toBe("true");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("reset preserves leading-zero codes, excludes confirmation and maps password to API newPassword", async () => {
  show(<PasswordResetForm />);
  fill(ru.Auth.email, "owner@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.sendCode }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  fill(ru.Identity.code, "000123");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, "Different1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.changePassword }),
  );
  expect(
    calls.some((call) => call.path.endsWith("/password-reset/confirm")),
  ).toBe(false);
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.changePassword }),
  );
  await screen.findByText(ru.Identity.resetSuccess);
  expect(
    calls.find((call) => call.path.endsWith("/password-reset/confirm"))?.body,
  ).toEqual({
    email: "owner@example.test",
    code: "000123",
    newPassword: "Abcdef1!",
  });
  expect(router.replace).not.toHaveBeenCalled();
});

test("reset resend clears only the code and preserves local passwords", async () => {
  show(<PasswordResetForm />);
  fill(ru.Auth.email, "owner@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.sendCode }),
  );
  await screen.findByLabelText(ru.Identity.code, { exact: false });
  fill(ru.Identity.code, "000123");
  fill(ru.Identity.newPassword, "Abcdef1!");
  fill(ru.Identity.confirmPassword, "Abcdef1!");
  await userEvent.click(
    screen.getByRole("button", { name: ru.Identity.resend }),
  );
  await screen.findByText(ru.Identity.resetResent);
  expect(
    (
      screen.getByLabelText(ru.Identity.code, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(
    (
      screen.getByLabelText(ru.Identity.newPassword, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("Abcdef1!");
  expect(
    (
      screen.getByLabelText(ru.Identity.confirmPassword, {
        exact: false,
      }) as HTMLInputElement
    ).value,
  ).toBe("Abcdef1!");
});

test("login keeps a legacy password with spaces unchanged", async () => {
  show(<SignInForm returnTo="/account" />);
  fill(ru.Auth.email, "OWNER@example.test");
  fill(ru.Auth.password, " Old password1! ");
  await userEvent.click(screen.getByRole("button", { name: ru.Auth.submit }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
  expect(calls.find((call) => call.path.endsWith("/login"))?.body).toEqual({
    email: "owner@example.test",
    password: " Old password1! ",
  });
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
  client.setQueryData(["private", "owner"], "private data");
  await userEvent.click(screen.getByRole("button", { name: ru.Auth.logout }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(client.getQueryData(["private", "owner"])).toBeUndefined();
  expect(calls.filter((call) => call.path.endsWith("/logout"))).toHaveLength(1);
});
