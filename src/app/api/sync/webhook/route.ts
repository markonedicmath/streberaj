import { readState } from "@/lib/store";
import { secretEqual, synchronize } from "@/lib/google";
import { failure, json } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { sync } = await readState();
    if (
      !secretEqual(
        request.headers.get("x-goog-channel-token"),
        sync.watchToken,
      ) ||
      request.headers.get("x-goog-channel-id") !== sync.watchId ||
      request.headers.get("x-goog-resource-id") !== sync.resourceId
    )
      return json({ error: "Nedozvoljeno obaveštenje." }, 403);
    if (request.headers.get("x-goog-resource-state") === "sync")
      return json({ ok: true });
    await synchronize();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
