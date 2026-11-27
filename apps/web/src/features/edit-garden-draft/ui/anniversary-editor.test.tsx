// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  saveProjectDraft,
  type AnniversaryContentDto,
  type ProjectDto,
} from "@shared/api";
import { isGuestPublication } from "@shared/api/guest-publication-validation";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { AnniversaryEditor } from "./anniversary-editor";

vi.mock("@shared/api", async (load) => ({
  ...(await load<typeof import("@shared/api")>()),
  saveProjectDraft: vi.fn(),
}));

const { show } = setupIdentityTest();
const id = "f729d400-0942-4633-9bc7-f33ffe78c422";
const content: AnniversaryContentDto = {
  locale: "ru",
  celebrant: "Алиса",
  event: { date: "", startTime: "", timeZone: "" },
  venue: { name: "", address: "" },
  photo: { mediaId: null, alt: "" },
  note: { enabled: false, text: "" },
  copy: {
    eyebrow: "",
    letter: "",
    caption: "",
    placeHeading: "",
    dateLabel: "",
    noteHeading: "",
    photoHeading: "",
    rsvpHeading: "",
    rsvpIntro: "",
    rsvpAction: "Ответить",
    signoff: "",
  },
};

test("saves the birthday schema and revision while preserving other authored fields", async () => {
  const project: ProjectDto = {
    id,
    templateVersionId: "birthday-anniversary-v1",
    title: "Birthday",
    revision: 3,
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    firstPublishedAt: null,
    canEditDraft: true,
    content,
  };
  const save = vi.mocked(saveProjectDraft);
  save.mockImplementation(async (_id, input) => ({
    ...project,
    ...input,
    revision: 4,
  }));
  show(<AnniversaryEditor project={project} />);
  fireEvent.change(screen.getByLabelText(ru.DraftEditor.anniversary.caption), {
    target: { value: "Встречаемся" },
  });
  fireEvent.click(screen.getByRole("button", { name: ru.DraftEditor.save }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      id,
      {
        title: project.title,
        expectedRevision: 3,
        content: {
          ...content,
          copy: { ...content.copy, caption: "Встречаемся" },
        },
      },
      expect.anything(),
    ),
  );
});

test("accepts only the Anniversary schema and public cover token for the birthday version", () => {
  const publication = {
    templateVersionId: "birthday-anniversary-v1",
    snapshotId: id,
    rsvp: {
      formVersionId: id,
      schema: "garden-v1",
      nameMaxLength: 80,
      maxCompanions: 2,
    },
    cover: { width: 960, height: 640 },
    content: { ...content, photo: { ...content.photo, mediaId: id } },
  };
  expect(isGuestPublication(publication)).toBe(true);
  expect(
    isGuestPublication({
      ...publication,
      templateVersionId: "wedding-together-v1",
    }),
  ).toBe(false);
  expect(
    isGuestPublication({
      ...publication,
      content: { ...content, photo: { mediaId: "private", alt: "" } },
    }),
  ).toBe(false);
});
