import { run } from "./common.mjs";
await run("go", ["test", "./..."], "services/api");
await run("go", ["vet", "./..."], "services/api");
await run("cargo", ["test", "--locked"], "services/recommender");
await run(
  "cargo",
  ["clippy", "--locked", "--", "-D", "warnings"],
  "services/recommender",
);
await run("pnpm", ["build"], "apps/kiosk");
