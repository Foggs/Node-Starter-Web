import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "../not-found";

describe("NotFound page", () => {
  it("renders a 404 heading and helpful copy", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: /404 page not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/did you forget to add the page to the router\?/i),
    ).toBeInTheDocument();
  });
});
