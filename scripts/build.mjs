import { run } from "./common.mjs";
await run("pnpm", ["build"], "apps/kiosk");
await run(
  "go",
  [
    "build",
    "-o",
    "../../bin/biteos-api" + (process.platform === "win32" ? ".exe" : ""),
    ".",
  ],
  "services/api",
);
await run("cargo", ["build", "--release", "--locked"], "services/recommender");
