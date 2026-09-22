import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function run(command, args, cwd = ".", env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      cwd: path.join(root, cwd),
      stdio: "inherit",
      shell: process.platform === "win32" && command === "pnpm",
      env: { ...process.env, ...env },
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
