import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedBody, detectMime } from "../src/lib/files";
test("prilog se proverava po sadržaju, ne po nazivu", () => {
  assert.equal(detectMime(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(
    detectMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.throws(
    () => detectMime(Buffer.from("<script>alert(1)</script>")),
    /Dozvoljeni/,
  );
});
test("prevelik zahtev se odbija i bez Content-Length zaglavlja", async () => {
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: "123456789",
  });
  await assert.rejects(boundedBody(request, 4), /prevelik/);
});
