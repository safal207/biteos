import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const run = (bin, args, cwd) => execFileSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const items = [];
const virtualStore = join(root, "apps/kiosk/node_modules/.pnpm");
for (const entry of readdirSync(virtualStore, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
  const modules = join(virtualStore, entry.name, "node_modules");
  // Only physical package directories; dependency symlinks are enumerated separately.
  for (const part of readdirSync(modules, { withFileTypes: true })) {
    if (!part.isDirectory()) continue;
    const base = join(modules, part.name);
    const dirs = part.name.startsWith("@")
      ? readdirSync(base, { withFileTypes: true }).filter(p => p.isDirectory()).map(p => join(base, p.name))
      : [base];
    for (const dir of dirs) {
      const p = read(join(dir, "package.json"));
      items.push({ ecosystem: "npm", name: p.name, version: p.version, license: typeof p.license === "string" ? p.license : null });
    }
  }
}
if (!items.length) throw new Error("No pnpm package manifests found; install frozen dependencies first.");
const cargo = JSON.parse(run("cargo", ["metadata", "--locked", "--format-version", "1"], join(root, "services/recommender")));
for (const p of cargo.packages) {
  if (!p.source && cargo.workspace_members.includes(p.id)) continue;
  items.push({ ecosystem: "cargo", name: p.name, version: p.version, license: p.license ?? null, licenseFile: p.license_file ? true : false });
}
const modules = run("go", ["list", "-mod=readonly", "-m", "-f", "{{.Path}} {{.Version}}", "all"], join(root, "services/api")).trim().split(/\r?\n/);
for (const line of modules) {
  const [name, version] = line.trim().split(/\s+/);
  if (version) items.push({ ecosystem: "go", name, version, license: null });
}
const allowed = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "CC0-1.0"]);
const unique = [...new Map(items.map(i => [JSON.stringify(i), i])).values()].sort((a,b) => (a.ecosystem+a.name+a.version).localeCompare(b.ecosystem+b.name+b.version));
const report = unique.map(i => ({ ...i, triage: allowed.has(i.license) ? "simple-permissive-metadata" : "manual-review" }));
console.log(JSON.stringify({ scope: "installed npm / resolved cargo / go module IDs only", total: report.length, review: report.filter(i => i.triage === "manual-review").length, packages: report }, null, 2));
