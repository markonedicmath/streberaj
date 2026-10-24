import { DomainError } from "./domain";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export function detectMime(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return "image/jpeg";
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (b.length >= 5 && b.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  throw new DomainError("Dozvoljeni su samo PNG, JPG, WEBP i PDF dokumenti.");
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new DomainError("Zahtev je prevelik.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("Nedostaje sadržaj zahteva.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new DomainError("Zahtev je prevelik.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
