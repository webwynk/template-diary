import { render, screen } from "@testing-library/react";

import * as skeletons from "@/components/common/skeletons";

describe("loading screens", () => {
  it.each(Object.entries(skeletons))("%s announces itself once as loading", (_, Skeleton) => {
    const { container } = render(<Skeleton />);
    expect(screen.getAllByRole("status", { name: "Loading" })).toHaveLength(1);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
