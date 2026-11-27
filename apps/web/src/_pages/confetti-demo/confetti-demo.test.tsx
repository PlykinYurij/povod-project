// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ConfettiInvitation } from "@entities/invitation";
import { ConfettiDemoPage } from "./index";
import { confettiDemoContent } from "./demo-content";

afterEach(cleanup);

test("renders localized editable copy and keeps the demo RSVP disabled", () => {
  render(<ConfettiDemoPage locale="en" sample="full" />);
  expect(screen.getByRole("article").lang).toBe("en");
  expect(screen.getByRole("heading", { name: "Alice" })).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Confirm attendance" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("status").textContent).toBe("Photo unavailable");
});

test("hides empty optional sections and supplies accessible fallback labels", () => {
  const content = confettiDemoContent("en", "minimal");
  content.copy.rsvpHeading = "";
  render(
    <ConfettiInvitation
      content={content}
      renderRsvp={({ label }) => <button>{label}</button>}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByText("See you soon, Alice!")).toBeNull();
  expect(screen.queryByText("One small request")).toBeNull();
  expect(screen.getByRole("region", { name: "RSVP" })).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Confirm attendance" })
      .hasAttribute("disabled"),
  ).toBe(false);
});
