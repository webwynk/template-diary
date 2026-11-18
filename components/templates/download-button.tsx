import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Downloads the exact saved .json through the authenticated download route. */
export function DownloadButton({
  variationId,
  label = "Download .json",
  size = "sm",
  variant = "secondary",
}: {
  variationId: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "primary";
}) {
  return (
    <Button asChild variant={variant} size={size}>
      {/* A plain link: the route sets Content-Disposition, so the browser saves the file. */}
      <a href={`/api/variations/${variationId}/download`} download>
        <Download aria-hidden />
        {label}
      </a>
    </Button>
  );
}
