import { readFileSync } from "node:fs";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { NewTemplateForm } from "@/components/templates/new/new-template-form";

const createTemplateAction = vi.fn();
vi.mock("@/actions/templates", () => ({
  createTemplateAction: (fd: FormData) => createTemplateAction(fd),
}));
const uploadFeatureImageAction = vi.fn();
vi.mock("@/actions/feature-images", () => ({
  uploadFeatureImageAction: (fd: FormData) => uploadFeatureImageAction(fd),
}));
const requestScreenshot = vi.fn<(body: unknown) => Promise<{ ok: boolean; url: null }>>(
  async () => ({ ok: true, url: null }),
);
vi.mock("@/lib/images/prepare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/prepare")>()),
  requestScreenshot: (body: unknown) => requestScreenshot(body),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// jsdom has no CompressionStream; gzip itself is covered by lib/templates/upload.test.ts.
vi.mock("@/lib/templates/upload", () => ({
  MAX_UPLOAD_BYTES: 4 * 1024 * 1024,
  gzipText: async (text: string) => new Blob([text]),
}));
// Monaco isn't needed for these tests (the Elementor path has no code editor).
vi.mock("@/components/templates/code-editor", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const ELEMENTOR = readFileSync("lib/engine/__tests__/fixtures/elementor-section.json", "utf8");

function file(content: string, name = "hero.json") {
  const f = new File([content], name, { type: "application/json" });
  // jsdom's File has no text(); use the real content.
  Object.defineProperty(f, "text", { value: async () => content });
  return f;
}

describe("NewTemplateForm", () => {
  beforeEach(() => {
    createTemplateAction.mockReset();
    uploadFeatureImageAction.mockReset();
    requestScreenshot.mockClear();
    push.mockReset();
  });

  it("checks the details before moving on", () => {
    render(<NewTemplateForm tags={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Enter a template name.")).toBeInTheDocument();
    expect(screen.getByText("Choose Custom code or Elementor.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2 · Details")).toBeInTheDocument();
  });

  it("uploads an Elementor export and sends it with the details", async () => {
    createTemplateAction.mockResolvedValueOnce({
      ok: false,
      error: "One of the selected tags no longer exists.",
    });
    render(
      <NewTemplateForm
        tags={[{ id: "4f8e2a7c-1b3d-4c5e-9f60-7a8b9c0d1e2f", name: "Hero", color: "#4F46E5" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Hero section" } });
    fireEvent.click(screen.getByLabelText(/Elementor/));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Step 2 of 2 · Content")).toBeInTheDocument();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file("not json")] } });
    expect(await screen.findByText("This file isn't valid JSON.")).toBeInTheDocument();

    fireEvent.change(input as HTMLInputElement, { target: { files: [file(ELEMENTOR)] } });
    expect(await screen.findByText(/Elementor section · 3 widgets/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create template/i }));
    await waitFor(() => expect(createTemplateAction).toHaveBeenCalledTimes(1));
    const fd = createTemplateAction.mock.calls[0]?.[0] as FormData;
    expect(fd.get("name")).toBe("Hero section");
    expect(fd.get("type")).toBe("elementor");
    expect(fd.get("tagIds")).toBe("[]");
    expect(fd.get("content")).toBeInstanceOf(Blob);
    expect(
      await screen.findByText("One of the selected tags no longer exists."),
    ).toBeInTheDocument();
  });

  it("asks for code before creating a Custom template", () => {
    render(<NewTemplateForm tags={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Hero" } });
    fireEvent.click(screen.getByLabelText(/Custom code/));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /create template/i }));
    expect(screen.getByText("Paste your template code.")).toBeInTheDocument();
    expect(createTemplateAction).not.toHaveBeenCalled();
  });

  it("creates a Custom template, asks for the automatic image and opens the editor", async () => {
    createTemplateAction.mockResolvedValueOnce({ ok: true, id: "new-id" });
    render(<NewTemplateForm tags={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Hero" } });
    fireEvent.click(screen.getByLabelText(/Custom code/));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByLabelText("Create from the desktop preview")).toBeChecked();
    fireEvent.change(screen.getByTestId("code-editor"), { target: { value: "<p>Hi</p>" } });
    fireEvent.click(screen.getByRole("button", { name: /create template/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/templates/new-id/edit"));
    expect(requestScreenshot).toHaveBeenCalledWith({ templateId: "new-id", replace: false });
    expect(uploadFeatureImageAction).not.toHaveBeenCalled();
  });
});
