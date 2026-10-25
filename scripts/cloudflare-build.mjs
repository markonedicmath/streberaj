import { spawnSync } from "node:child_process";
import { copyFileSync,cpSync,mkdirSync } from "node:fs";
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
  stdio: "inherit", env: { ...process.env, NEXT_CLOUDFLARE_BUILD: "1", NEXT_DIST_DIR: ".next-native-ui" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
// The dashboard is entirely client-side. Serve its prerendered shell directly
// through Cloudflare Assets instead of spending Worker CPU rendering it again.
mkdirSync(".worker/assets/_next",{recursive:true});
cpSync("public",".worker/assets",{recursive:true});
cpSync(".next-native-ui/static",".worker/assets/_next/static",{recursive:true});
copyFileSync(".next-native-ui/server/app/index.html", ".worker/assets/index.html");
copyFileSync(".next-native-ui/server/app/icon.png.body", ".worker/assets/icon.png");
const worker=spawnSync(process.execPath,["scripts/build-worker.mjs"],{stdio:"inherit"});
process.exit(worker.status??1);
