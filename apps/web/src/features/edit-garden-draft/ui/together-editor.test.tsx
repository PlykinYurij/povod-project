// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { saveProjectDraft, type ProjectDto } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { TogetherEditor } from "./together-editor";

vi.mock("@shared/api", async (load) => ({
  ...(await load<typeof import("@shared/api")>()),
  saveProjectDraft: vi.fn(),
}));

const { show } = setupIdentityTest();

test("saves authored labels and optional blocks with the Together revision", async () => {
  const project: ProjectDto = {
    id: "f729d400-0942-4633-9bc7-f33ffe78c422",
    title: "Wedding",
    templateVersionId: "wedding-together-v1",
    revision: 3,
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    firstPublishedAt: null,
    canEditDraft: true,
    content: {
      locale: "ru",
      names: { first: "Dana", second: "Alex" },
      event: { date: "", startTime: "", timeZone: "" },
      venue: { name: "", address: "" },
      photo: { mediaId: null, alt: "" },
      note: { enabled: false, heading: "", body: "" },
      copy: {
        heroLabel: "",
        separator: "",
        intro: "",
        eventHeading: "",
        dateLabel: "",
        venueLabel: "",
        photoHeading: "",
        rsvpHeading: "",
        rsvpIntro: "",
        rsvpAction: "Respond",
        signoff: "",
      },
    },
  };
  const save = vi.mocked(saveProjectDraft);
  save.mockImplementation(async (_id, input) => ({
    ...project,
    ...input,
    revision: input.expectedRevision + 1,
  }));
  show(<TogetherEditor project={project} />);
  fireEvent.change(screen.getByLabelText(ru.DraftEditor.together.rsvpAction), {
    target: { value: "Count me in" },
  });
  await userEvent.click(
    screen.getByLabelText(ru.DraftEditor.together.noteEnabled),
  );
  await userEvent.click(
    screen.getByRole("button", { name: ru.DraftEditor.save }),
  );
  expect(await screen.findByText(ru.DraftEditor.saved)).toBeTruthy();
  expect(save.mock.calls[0]?.[1]).toMatchObject({
    expectedRevision: 3,
    content: {
      copy: { rsvpAction: "Count me in" },
      note: { enabled: true },
      photo: { mediaId: null },
    },
  });
});
