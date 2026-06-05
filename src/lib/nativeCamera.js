import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

export function isNativeCameraAvailable() {
  return Capacitor.isNativePlatform();
}

/** Pick a photo from the native camera or gallery. Returns a File for the upload flow. */
export async function captureNativePhoto(source = CameraSource.Camera) {
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source,
    saveToGallery: false,
  });

  if (!photo.webPath) {
    throw new Error("No image captured.");
  }

  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const ext = photo.format === "png" ? "png" : "jpg";
  const file = new File([blob], `photo-${Date.now()}.${ext}`, {
    type: blob.type || `image/${ext}`,
  });

  return {
    file,
    preview: photo.webPath,
    mediaType: "image",
  };
}
