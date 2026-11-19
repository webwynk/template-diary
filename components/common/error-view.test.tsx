import { fireEvent, render, screen } from "@testing-library/react";

import { ErrorView } from "@/components/common/error-view";

describe("ErrorView", () => {
  it("shows a plain message with the error code and retries", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const error = Object.assign(new Error("secret details"), { digest: "abc123" });
    render(<ErrorView error={error} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Error code: abc123")).toBeInTheDocument();
    expect(screen.queryByText(/secret details/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
