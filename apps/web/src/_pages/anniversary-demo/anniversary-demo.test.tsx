// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AnniversaryDemoPage } from "./index";

afterEach(cleanup);

test("preview keeps RSVP disabled and reports pending photos in the invitation locale", () => {
  render(<AnniversaryDemoPage locale="en" sample="pending" />);

  expect(screen.getByRole("article")).toHaveProperty("lang", "en");
  expect(screen.getByRole("status").textContent).toBe("Photo is processing");
  expect(
    screen
      .getByRole("button", { name: "Confirm attendance" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

test("minimal preview omits the photo caption, note and signoff", () => {
  render(<AnniversaryDemoPage locale="en" sample="minimal" />);

  expect(screen.queryByRole("figure")).toBeNull();
  expect(screen.queryByText("A small request")).toBeNull();
  expect(screen.queryByText("See you soon, Alice!")).toBeNull();
});
