// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ApiRequestError,
  getProject,
  saveProjectDraft,
  type ProjectDto,
} from "@shared/api";
import { getGardenCopyPreset } from "@shared/i18n/garden";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { GardenEditor } from "./garden-editor";

vi.mock("@shared/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@shared/api")>()),
  getProject: vi.fn(),
  saveProjectDraft: vi.fn(),
}));

const { show } = setupIdentityTest();
const save = vi.mocked(saveProjectDraft);
const load = vi.mocked(getProject);
const t = ru.DraftEditor;
const project: ProjectDto = {
  id: "f729d400-0942-4633-9bc7-f33ffe78c422",
  title: "Мой черновик",
  templateVersionId: "wedding-garden-v1",
  revision: 3,
  createdAt: "2026-11-21T00:00:00.000Z",
  updatedAt: "2026-11-21T00:00:00.000Z",
  firstPublishedAt: null,
  canEditDraft: true,
  content: {
    locale: "ru",
    themeId: "sage",
    heroMediaId: null,
    names: { first: "", second: "" },
    event: { localDate: "", localTime: "", timeZone: "" },
    venue: { name: "", address: "", routeUrl: null },
    copy: getGardenCopyPreset("ru"),
    program: [{ time: "12:00", text: "Сбор гостей" }],
  },
};

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: t.save }));
const titleField = () => screen.getByRole("textbox", { name: t.title });

beforeEach(() => {
  save.mockReset();
  load.mockReset();
});

test("saves editable copy and disables the program with null", async () => {
  save.mockImplementation(async (_id, input) => ({
    ...project,
    ...input,
    revision: input.expectedRevision + 1,
  }));
  show(<GardenEditor project={project} />);
  fireEvent.change(screen.getByRole("textbox", { name: t.copy.footerText }), {
    target: { value: "" },
  });
  await userEvent.click(screen.getByRole("checkbox", { name: t.showProgram }));
  await submit();
  expect(await screen.findByText(t.saved)).toBeTruthy();
  expect(save.mock.calls[0]?.[1]).toMatchObject({
    expectedRevision: 3,
    content: { copy: { footerText: "" }, program: null, heroMediaId: null },
  });
  fireEvent.change(titleField(), { target: { value: "Новое название" } });
  await submit();
  expect(await screen.findByText(t.saved)).toBeTruthy();
  expect(save.mock.calls[1]?.[1].expectedRevision).toBe(4);
});

test("conflict keeps local edits until the user loads a fresh revision", async () => {
  save.mockRejectedValueOnce(new ApiRequestError(409, "REVISION_CONFLICT"));
  load.mockResolvedValueOnce({
    ...project,
    title: "Другая вкладка",
    revision: 4,
  });
  show(<GardenEditor project={project} />);
  fireEvent.change(titleField(), { target: { value: "Мои правки" } });
  await submit();
  expect(await screen.findByText(t.conflict)).toBeTruthy();
  expect(titleField()).toHaveProperty("value", "Мои правки");
  expect(screen.getByRole("button", { name: t.save })).toHaveProperty(
    "disabled",
    true,
  );
  expect(load).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: t.discardAndLoad }));
  expect(await screen.findByText(t.loaded)).toBeTruthy();
  expect(titleField()).toHaveProperty("value", "Другая вкладка");
});

test("maps API validation to the affected field without clearing inputs", async () => {
  save.mockRejectedValueOnce(
    new ApiRequestError(422, "VALIDATION_FAILED", [
      { path: "content.venue.routeUrl", code: "INVALID_VALUE" },
    ]),
  );
  show(<GardenEditor project={project} />);
  const route = screen.getByRole("textbox", { name: t.route });
  fireEvent.change(route, { target: { value: "http://example.test" } });
  await submit();
  expect(await screen.findByText(t.invalid)).toBeTruthy();
  expect(route).toHaveProperty("value", "http://example.test");
  expect(screen.queryByText(t.saved)).toBeNull();
});
