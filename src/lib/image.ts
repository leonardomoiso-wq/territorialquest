"use client";

/**
 * Riduce una foto prima dell'invio: lato lungo al massimo 1600 px, JPEG di buona qualità.
 * Una foto di telefono passa da 4–8 MB a 300–500 KB: l'invio è molto più rapido con poca rete.
 * Ridisegnandola si perdono anche i metadati (posizione GPS dello scatto, modello del telefono).
 * Se il browser non sa leggere il formato (per esempio HEIC su alcuni computer) si invia l'originale.
 */
export async function shrinkImage(file: File, max = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) { bitmap.close(); return file; }
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) { bitmap.close(); return file; }
    g.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
