import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { deviceForWidth } from "@/components/editor/devices";
import { PreferencesForm } from "@/components/settings/preferences-form";

const save = vi.fn();
vi.mock("@/actions/settings", () => ({ savePreferencesAction: (p: unknown) => save(p) }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

describe("PreferencesForm", () => {
  it("starts from the saved values and saves only after a change", async () => {
    save.mockResolvedValue({ ok: true });
    render(<PreferencesForm initial={{ defaultDevice: 1440, defaultFeatureMode: "auto" }} />);
    const button = screen.getByRole("button", { name: "Save preferences" });
    expect(button).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Desktop/ })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /Tablet/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Upload my own image" }));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ defaultDevice: 768, defaultFeatureMode: "upload" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Preferences saved"));
  });

  it("shows a save error", async () => {
    save.mockResolvedValue({ ok: false, error: "Nope." });
    render(<PreferencesForm initial={{ defaultDevice: 375, defaultFeatureMode: "upload" }} />);
    fireEvent.click(screen.getByRole("radio", { name: /Desktop/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope."));
  });
});

it("deviceForWidth maps stored widths to preview devices", () => {
  expect(deviceForWidth(1440)).toBe("desktop");
  expect(deviceForWidth(768)).toBe("tablet");
  expect(deviceForWidth(375)).toBe("mobile");
  expect(deviceForWidth(999)).toBe("desktop");
});
