// Repo checks for CI: manifests agree, every skill has valid frontmatter, and the installer runs end to end.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KIT_ROOT, SKILLS } from "../cli/lib/install.mjs";

const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
};
const json = (p) => JSON.parse(fs.readFileSync(path.join(KIT_ROOT, p), "utf8"));

const pkg = json("package.json");
const plugin = json(".claude-plugin/plugin.json");
const market = json(".claude-plugin/marketplace.json");
if (pkg.version !== plugin.version) fail(`package.json ${pkg.version} != plugin.json ${plugin.version}`);
if (!market.plugins.some((p) => p.name === plugin.name)) fail("marketplace.json does not list the plugin");

const onDisk = fs.readdirSync(path.join(KIT_ROOT, "skills")).filter((d) => !d.startsWith("."));
for (const dir of onDisk) {
  const md = fs.readFileSync(path.join(KIT_ROOT, "skills", dir, "SKILL.md"), "utf8");
  const front = (md.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "").replace(/\r/g, "");
  if (!new RegExp(`^name: ${dir}$`, "m").test(front)) fail(`skills/${dir}: name must equal the folder`);
  if (!/^description: .{20,}/m.test(front)) fail(`skills/${dir}: missing description`);
  if (!SKILLS.some((s) => s.name === dir)) fail(`skills/${dir} is not listed in cli/lib/install.mjs`);
}

// Smoke test: non-interactive install into a throwaway home and project, twice (must be idempotent).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "unsl0p-check-"));
const env = { ...process.env, HOME: tmp, USERPROFILE: tmp };
delete env.CLAUDE_CONFIG_DIR;
const cli = path.join(KIT_ROOT, "cli/index.mjs");
// Seed an old install to test the migration (the watch from "unslop", the import line from "bangers").
fs.mkdirSync(path.join(tmp, ".claude/unslop"), { recursive: true });
fs.writeFileSync(path.join(tmp, ".claude/unslop/design-references.md"), "my own watch\n");
fs.writeFileSync(path.join(tmp, ".claude/CLAUDE.md"), "# Mine\n\n# Bangers kit\n@~/.claude/bangers/rules.md\n");
for (let i = 0; i < 2; i++) {
  execFileSync("node", [cli, "--yes"], { env, stdio: "pipe" });
  execFileSync("node", [cli, "--project", "--skills", "motion-system"], { env, cwd: tmp, stdio: "pipe" });
}
const expect = [
  ".claude/skills/motion-system/SKILL.md",
  ".claude/skills/scroll-film/SKILL.md",
  ".claude/commands/unsl0p-awwwards.md",
  ".claude/unsl0p/rules.md",
  ".claude/unsl0p/design-references.md",
  ".claude/CLAUDE.md",
  "CLAUDE.md",
];
for (const f of expect) if (!fs.existsSync(path.join(tmp, f))) fail(`installer did not create ${f}`);

const memory = fs.readFileSync(path.join(tmp, ".claude/CLAUDE.md"), "utf8");
if (memory.split("@~/.claude/unsl0p/rules.md").length !== 2) fail("global CLAUDE.md import line missing or duplicated");
if (memory.includes("bangers") || memory.includes("unslop")) fail("legacy import line was not migrated");
if (fs.readFileSync(path.join(tmp, ".claude/unsl0p/design-references.md"), "utf8") !== "my own watch\n") fail("legacy design watch was not migrated");
const project = fs.readFileSync(path.join(tmp, "CLAUDE.md"), "utf8");
if (!project.includes("@.claude/unsl0p/rules.md")) fail("project CLAUDE.md import line missing");
const cmd = fs.readFileSync(path.join(tmp, ".claude/commands/unsl0p-awwwards.md"), "utf8");
if (cmd.includes("/unsl0p:")) fail("installed command still uses the plugin namespace");

fs.rmSync(tmp, { recursive: true, force: true });
if (!process.exitCode) console.log(`ok   ${onDisk.length} skills, manifests at ${pkg.version}, installer smoke test`);
