import { spawn } from "node:child_process";
import path from "node:path";
import { root } from "./common.mjs";
const windows = process.platform === "win32";
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (windows && child.pid)
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    else child.kill("SIGTERM");
  }
}
function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd: path.join(root, cwd),
    stdio: "inherit",
    shell: windows && command === "pnpm",
    env: process.env,
  });
  children.push(child);
  child.on("error", (err) => {
    console.error(err.message);
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start("cargo", ["run", "--locked"], "services/recommender");
start("go", ["run", "."], "services/api");
start("pnpm", ["dev"], "apps/kiosk");
console.log(
  "\nBiteOS kiosk: http://127.0.0.1:5173 (wait for all three services to start)\n",
);
