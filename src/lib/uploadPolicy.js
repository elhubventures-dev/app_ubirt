export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
export const ALLOWED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

export function isAllowedImageFile(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(type)) return true;
  const ext = file.name?.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}

export function validateImageFile(file) {
  if (!file) {
    throw new Error("Please select an image.");
  }
  if (!isAllowedImageFile(file)) {
    throw new Error("Only JPG, JPEG, and PNG images are supported right now.");
  }
}
