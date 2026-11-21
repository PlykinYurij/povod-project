// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiRequestError, createProject } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { CreateProjectForm } from "./create-project-form";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/api")>()),
  createProject: vi.fn(),
}));

const { show, fill } = setupIdentityTest();
const create = vi.mocked(createProject);
const t = ru.Projects;

function showForm() {
  show(
    <CreateProjectForm
      templateTitle="Тихий сад"
      templateVersionId="wedding-garden-v1"
      onUnauthorized={vi.fn()}
    />,
  );
  fill(t.name, "  День рождения  ");
}

beforeEach(() => {
  create.mockReset();
  router.replace.mockReset();
});

test("shows title validation under the field before making a request", async () => {
  showForm();
  fill(t.name, "🎉".repeat(25));
  await userEvent.click(screen.getByRole("button", { name: t.create }));
  expect(await screen.findByText(t.invalidName)).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
});

test("retries an uncertain outcome with the same title, template and key", async () => {
  create.mockRejectedValueOnce(new ApiRequestError(503, "SERVICE_UNAVAILABLE"));
  create.mockImplementationOnce(async () => {
    // The form only needs a successful response to navigate to the project list.
    return await new Promise((resolve) =>
      resolve({
        id: "saved",
        templateVersionId: "wedding-garden-v1",
        title: "День рождения",
        revision: 1,
        createdAt: "2026-11-21T00:00:00.000Z",
        updatedAt: "2026-11-21T00:00:00.000Z",
        firstPublishedAt: null,
        canEditDraft: true,
        get content(): never {
          throw new Error("Creation should not read content");
        },
      }),
    );
  });
  showForm();
  await userEvent.click(screen.getByRole("button", { name: t.create }));
  expect(await screen.findByText(t.verifySave)).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: t.name }).hasAttribute("readonly"),
  ).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: t.retry }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
  const [first, second] = create.mock.calls;
  expect(first[0]).toEqual({
    title: "День рождения",
    templateVersionId: "wedding-garden-v1",
  });
  expect(second[0]).toEqual(first[0]);
  expect(second[1]?.headers).toEqual(first[1]?.headers);
});

test("shows the draft quota and keeps the input after a definitive refusal", async () => {
  create.mockRejectedValueOnce(new ApiRequestError(409, "DRAFT_LIMIT_REACHED"));
  showForm();
  await userEvent.click(screen.getByRole("button", { name: t.create }));
  expect((await screen.findByRole("alert")).textContent).toContain(t.quota);
  const input = screen.getByRole("textbox", { name: t.name });
  expect(input).toHaveProperty("value", "  День рождения  ");
  expect(router.replace).not.toHaveBeenCalled();
});
