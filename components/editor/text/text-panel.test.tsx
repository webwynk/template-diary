import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { faClasses, iconModes } from "@/components/editor/text/icon-picker";
import { TextPanel } from "@/components/editor/text/text-panel";
import { detectText } from "@/lib/engine";

vi.mock("@/lib/icons/fa-free.json", () => ({
  default: [
    ["star", "sr", "favorite"],
    ["github", "b"],
  ],
}));

const HTML =
  '<section><span class="eyebrow">New</span><h2>Big title</h2><a class="btn" href="/go"><i class="fa-solid fa-rocket"></i> Start</a></section>';

function renderPanel(text = {}, type: "custom" | "elementor" = "custom", content = HTML) {
  const dispatch = vi.fn();
  render(
    <TextPanel type={type} model={detectText(content, type)} text={text} dispatch={dispatch} />,
  );
  return dispatch;
}

describe("TextPanel", () => {
  it("shows groups and fields, and dispatches edits", () => {
    const dispatch = renderPanel();
    expect(screen.getByRole("button", { name: /Heading/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Bigger title" } });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "setText",
      key: "section[0]/h2[0]|text",
      entry: { to: "Bigger title" },
    });
  });

  it("resets a field typed back to its original text", () => {
    const dispatch = renderPanel({ "section[0]/h2[0]|text": { to: "Bigger title" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Big title" } });
    expect(dispatch).toHaveBeenLastCalledWith({ type: "resetText", key: "section[0]/h2[0]|text" });
  });

  it("shows the session's value and collapses groups", () => {
    renderPanel({ "section[0]/span[0]|text": { to: "Fresh" } });
    expect(screen.getByLabelText("Eyebrow")).toHaveValue("Fresh");
    fireEvent.click(screen.getByRole("button", { name: /Heading/ }));
    expect(screen.queryByLabelText("Eyebrow")).not.toBeInTheDocument();
  });

  it("keeps an invalid link in the box with an error and doesn't apply it", () => {
    const dispatch = renderPanel();
    fireEvent.change(screen.getByLabelText("Button link"), {
      target: { value: "javascript:alert(1)" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/Links can start with/);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Button link"), { target: { value: "/start" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "setText",
      key: "section[0]/a[0]|href",
      entry: { to: "/start" },
    });
  });

  it("changes an icon from the Font Awesome list in the template's notation", async () => {
    const dispatch = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Change Button icon" }));
    fireEvent.click(await screen.findByRole("button", { name: "star (Solid)" }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "setText",
      key: "section[0]/a[0]/i[0]|icon",
      entry: { to: "fa-solid fa-star", as: "class" },
    });
  });

  it("validates icon classes and SVG code before using them", async () => {
    const dispatch = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Change Button icon" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "SVG" }));
    fireEvent.click(screen.getByRole("tab", { name: "SVG" }));
    const box = await screen.findByLabelText("SVG code");
    fireEvent.change(box, { target: { value: '<svg onload="x"></svg>' } });
    fireEvent.click(screen.getByRole("button", { name: "Use this icon" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/can't contain scripts/);
    fireEvent.change(box, { target: { value: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' } });
    fireEvent.click(screen.getByRole("button", { name: "Use this icon" }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenLastCalledWith({
        type: "setText",
        key: "section[0]/a[0]/i[0]|icon",
        entry: { to: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', as: "svg" },
      }),
    );
  });

  it("opens the group and focuses the field a preview click asks for (T4)", () => {
    const model = detectText(HTML, "custom");
    const props = { type: "custom" as const, model, text: {}, dispatch: vi.fn() };
    const { rerender } = render(<TextPanel {...props} focus={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Heading/ }));
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    rerender(<TextPanel {...props} focus={{ key: "section[0]/h2[0]|text", n: 1 }} />);
    expect(screen.getByLabelText("Title")).toHaveFocus();

    // Icons focus their Change button; an unknown key does nothing.
    rerender(<TextPanel {...props} focus={{ key: "section[0]/a[0]/i[0]|icon", n: 2 }} />);
    expect(screen.getByRole("button", { name: /Change Button icon/ })).toHaveFocus();
    rerender(<TextPanel {...props} focus={{ key: "nope|text", n: 3 }} />);
    expect(screen.getByRole("button", { name: /Change Button icon/ })).toHaveFocus();
  });

  it("explains an empty template and shows engine notes", () => {
    renderPanel({}, "custom", "<style>a{}</style>");
    expect(screen.getByText("No text found in this template.")).toBeInTheDocument();
  });
});

describe("icon helpers", () => {
  it("writes picked icons in the template's own Font Awesome notation", () => {
    expect(faClasses("star", "s", "fa-solid fa-bolt", "custom")).toBe("fa-solid fa-star");
    expect(faClasses("star", "r", "fas fa-bolt", "custom")).toBe("far fa-star");
    expect(faClasses("star", "s", "fa fa-bolt", "custom")).toBe("fa fa-star");
    expect(faClasses("github", "b", "fa fa-bolt", "custom")).toBe("fab fa-github");
    expect(faClasses("star", "s", "", "elementor")).toBe("fas fa-star");
  });

  it("offers only what each template type can store", () => {
    expect(iconModes("elementor", "font")).toEqual(["class", "image"]);
    expect(iconModes("custom", "ligature")).toEqual(["ligature", "class", "svg", "image"]);
    expect(iconModes("custom", "svg")).toEqual(["class", "svg", "image"]);
  });
});
