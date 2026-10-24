import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"], {
  stdio: "inherit", env: { ...process.env, NEXT_CLOUDFLARE_BUILD: "1" },
});
process.exit(result.status ?? 1);
