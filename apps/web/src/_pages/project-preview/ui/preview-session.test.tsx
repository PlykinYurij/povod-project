// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useGetProject } from "@shared/api";
import ru from "@shared/i18n/ru.json";
import { setupIdentityTest } from "@shared/lib/testing/setup-identity-test";
import { PreviewSession } from "./preview-session";

vi.mock("@shared/api", async (load) => ({
  ...(await load<typeof import("@shared/api")>()),
  useGetProject: vi.fn(),
}));
vi.mock("@entities/identity", () => ({
  usePrivateSession: () => ({ session: { data: { user: { id: "owner" } } } }),
}));
vi.mock("@widgets/private-garden-preview", () => ({
  PrivateGardenPreview: () => <p>Invitation preview</p>,
}));
vi.mock("@features/request-service", () => ({
  PublicationRequestPanel: () => <form aria-label="Publication request" />,
}));
vi.mock("../model/is-garden-complete", () => ({
  isGardenComplete: () => true,
}));

const { show } = setupIdentityTest();
const projectId = "0d17bd3d-52b8-4b77-b7e7-a6b319a2740b";

test.each([null, "2026-11-01T10:00:00.000Z"])(
  "only exposes first-publication controls for an editable project with firstPublishedAt=%s",
  (firstPublishedAt) => {
    vi.mocked(useGetProject).mockReturnValue({
      data: {
        templateVersionId: "wedding-garden-v1",
        canEditDraft: true,
        firstPublishedAt,
        revision: 2,
      },
    } as ReturnType<typeof useGetProject>);
    show(<PreviewSession projectId={projectId} />);

    expect(
      screen.getByRole("link", { name: ru.ProjectPreview.edit }),
    ).toBeTruthy();
    expect(
      !!screen.queryByRole("link", { name: ru.ProjectPreview.requestJump }),
    ).toBe(firstPublishedAt === null);
    expect(!!screen.queryByRole("form", { name: "Publication request" })).toBe(
      firstPublishedAt === null,
    );
  },
);
