// Dependency-free install logic, shared by the npx installer and the plugin's /unslop:setup.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const SKILLS = [
  { name: "motion-system", hint: "tokens, smooth scroll, reveals, transitions, WebGL loading" },
  { name: "brand-kit", hint: "logo set, OKLCH tokens, favicons, OG images, guidelines" },
  { name: "press-kit", hint: "press page, exports, X kit, motion loops" },
  { name: "redesign-thread", hint: "unofficial redesign as a thread of images" },
  { name: "code-film", hint: "a film written in code, rendered to video" },
  { name: "scroll-film", hint: "scroll-driven film from generated shots (paid API)" },
];

export const COMMANDS = ["awwwards", "scout"];

const PLACEHOLDER = "~/.claude/unslop";

// Where everything goes for a given scope. `legacy` is where versions before 0.3.0 (named "bangers") installed.
export function targets(scope, cwd = process.cwd()) {
  if (scope === "project") {
    const config = path.join(cwd, ".claude");
    return {
      config,
      dir: path.join(config, "unslop"),
      shown: ".claude/unslop",
      memory: path.join(cwd, "CLAUDE.md"),
      legacy: { dir: path.join(config, "bangers"), shown: ".claude/bangers" },
    };
  }
  const home = os.homedir();
  const config = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");
  const isDefault = config === path.join(home, ".claude");
  const dir = path.join(config, "unslop");
  const legacyDir = path.join(config, "bangers");
  return {
    config,
    dir,
    shown: isDefault ? PLACEHOLDER : dir,
    memory: path.join(config, "CLAUDE.md"),
    legacy: { dir: legacyDir, shown: isDefault ? "~/.claude/bangers" : legacyDir },
  };
}

function render(text, t, { flattenCommands = false } = {}) {
  let out = text.split(PLACEHOLDER).join(t.shown);
  // Outside the plugin, commands are not namespaced: /unslop:scout becomes /unslop-scout.
  if (flattenCommands) out = out.replace(/\/unslop:([a-z-]+)/g, "/unslop-$1");
  return out;
}

const read = (p) => fs.readFileSync(p, "utf8");

function writeIfChanged(file, content, log) {
  if (fs.existsSync(file) && read(file) === content) return log("current", file);
  const existed = fs.existsSync(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  log(existed ? "updated" : "created", file);
}

// Rules are refreshed on every run (previous copy kept as .bak); the design watch is never overwritten.
export function installRules(t, log, opts = {}) {
  const rules = path.join(t.dir, "rules.md");
  const next = render(read(path.join(KIT_ROOT, "rules/rules.md")), t, opts);
  if (fs.existsSync(rules) && read(rules) !== next) {
    fs.copyFileSync(rules, `${rules}.bak`);
    log("backup", `${rules}.bak`);
  }
  writeIfChanged(rules, next, log);

  const watch = path.join(t.dir, "design-references.md");
  const legacyWatch = path.join(t.legacy.dir, "design-references.md");
  if (fs.existsSync(watch)) {
    log("kept", `${watch} (yours)`);
  } else if (fs.existsSync(legacyWatch)) {
    fs.copyFileSync(legacyWatch, watch);
    log("migrated", `${legacyWatch} -> ${watch} (the old folder is left in place)`);
  } else {
    fs.mkdirSync(t.dir, { recursive: true });
    fs.copyFileSync(path.join(KIT_ROOT, "rules/design-references.md"), watch);
    log("created", watch);
  }

  const line = `@${t.shown}/rules.md`;
  let current = fs.existsSync(t.memory) ? read(t.memory) : "";
  const legacyLine = `@${t.legacy.shown}/rules.md`;
  if (current.split(/\r?\n/).includes(legacyLine)) {
    current = current.split(legacyLine).join(line).split("# Bangers kit\n").join("# unslop\n");
    fs.writeFileSync(t.memory, current);
    log("migrated", `${t.memory} now imports ${line}`);
  }
  if (current.split(/\r?\n/).includes(line)) {
    log("current", `${t.memory} already imports the rules`);
  } else {
    const sep = current === "" ? "" : current.endsWith("\n") ? "\n" : "\n\n";
    fs.mkdirSync(path.dirname(t.memory), { recursive: true });
    fs.writeFileSync(t.memory, `${current}${sep}# unslop\n${line}\n`);
    log("added", `import line to ${t.memory}`);
  }
}

function copyDir(src, dest, transform) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to, transform);
    else if (entry.name.endsWith(".md")) fs.writeFileSync(to, transform(read(from)));
    else fs.copyFileSync(from, to);
  }
}

export function installSkills(names, t, log) {
  for (const name of names) {
    const dest = path.join(t.config, "skills", name);
    const existed = fs.existsSync(dest);
    copyDir(path.join(KIT_ROOT, "skills", name), dest, (s) => render(s, t, { flattenCommands: true }));
    log(existed ? "updated" : "created", dest);
  }
}

export function installCommands(t, log) {
  for (const name of COMMANDS) {
    const src = read(path.join(KIT_ROOT, "commands", `${name}.md`));
    writeIfChanged(path.join(t.config, "commands", `unslop-${name}.md`), render(src, t, { flattenCommands: true }), log);
  }
}

export function version() {
  return JSON.parse(read(path.join(KIT_ROOT, "package.json"))).version;
}
