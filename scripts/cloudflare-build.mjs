import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
const result = spawnSync(process.execPath, ["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"], {
  stdio: "inherit", env: { ...process.env, NEXT_CLOUDFLARE_BUILD: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
// The dashboard is entirely client-side. Serve its prerendered shell directly
// through Cloudflare Assets instead of spending Worker CPU rendering it again.
copyFileSync(".next/server/app/index.html", ".open-next/assets/index.html");
