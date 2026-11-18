import { uploadFeatureImageAction, type FeatureImageResult } from "@/actions/feature-images";
import { prepareImage } from "@/lib/images/prepare";

/** Prepare a picked file in the browser and store it as a template or variation image. */
export async function uploadFeatureImage(input: {
  templateId: string;
  variationId?: string;
  file: File;
}): Promise<FeatureImageResult> {
  const prepared = await prepareImage(input.file);
  if (!prepared.ok) return prepared;
  const form = new FormData();
  form.set("templateId", input.templateId);
  if (input.variationId) form.set("variationId", input.variationId);
  form.set("image", prepared.blob, "image");
  try {
    return await uploadFeatureImageAction(form);
  } catch {
    return { ok: false, error: "Couldn't upload the image. Check your connection and try again." };
  }
}
