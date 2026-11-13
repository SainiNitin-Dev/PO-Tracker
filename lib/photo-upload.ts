/** Resize before upload to reduce mobile bandwidth and private storage use. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024 ||
    !file.size
  )
    throw new Error(
      "Choose a JPG, PNG or WebP smaller than 8 MB. On iPhone, export HEIC photos as JPG first.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("This image could not be opened.");
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Your browser could not prepare this photo.");
    return blob;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("This image could not be opened. Try another JPG or PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
