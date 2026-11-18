#!/usr/bin/env node
// npx unslop-kit: interactive installer for Claude Code users who do not use the plugin.
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { SKILLS, installCommands, installRules, installSkills, targets, version } from "./lib/install.mjs";

const HELP = `Usage: npx unslop-kit [options]

Without options, the installer asks what to install.

  -y, --yes            Install everything without prompts (global scope)
  -g, --global         Install into your Claude config directory (~/.claude)
  -p, --project        Install into ./.claude and ./CLAUDE.md
  --skills <list>      Comma-separated skills, or "all" (default with --yes)
  --no-rules           Skip the always-on rules and the design watch
  --no-commands        Skip /unslop-awwwards and /unslop-scout
  -v, --version        Print the version
  -h, --help           Print this help

Skills: ${SKILLS.map((s) => s.name).join(", ")}`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      yes: { type: "boolean", short: "y" },
      global: { type: "boolean", short: "g" },
      project: { type: "boolean", short: "p" },
      skills: { type: "string" },
      "no-rules": { type: "boolean" },
      "no-commands": { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  }));
} catch (err) {
  console.error(`${err.message}\n\n${HELP}`);
  process.exit(1);
}

if (args.help) {
  console.log(HELP);
  process.exit(0);
}
if (args.version) {
  console.log(version());
  process.exit(0);
}
if (args.global && args.project) {
  console.error("Choose either --global or --project, not both.");
  process.exit(1);
}

function parseSkills(value) {
  if (value === "all") return SKILLS.map((s) => s.name);
  const names = value.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((n) => !SKILLS.some((s) => s.name === n));
  if (unknown.length) {
    console.error(`Unknown skill: ${unknown.join(", ")}\n\n${HELP}`);
    process.exit(1);
  }
  return names;
}

const flagged = args.yes || args.global || args.project || args.skills !== undefined;
const ask = (value) => {
  if (p.isCancel(value)) {
    p.cancel("Nothing installed.");
    process.exit(0);
  }
  return value;
};

let plan;
if (flagged) {
  plan = {
    scope: args.project ? "project" : "global",
    skills: parseSkills(args.skills ?? "all"),
    rules: !args["no-rules"],
    commands: !args["no-commands"],
  };
} else {
  p.intro(`${pc.bold("unslop")} ${pc.dim(`v${version()}`)}`);
  plan = {
    skills: ask(
      await p.multiselect({
        message: "Which skills?",
        options: SKILLS.map((s) => ({ value: s.name, label: s.name, hint: s.hint })),
        initialValues: SKILLS.map((s) => s.name),
        required: false,
      }),
    ),
    scope: ask(
      await p.select({
        message: "Install where?",
        options: [
          { value: "global", label: "Everywhere", hint: "~/.claude, every project" },
          { value: "project", label: "This project only", hint: "./.claude and ./CLAUDE.md" },
        ],
      }),
    ),
    rules: ask(
      await p.confirm({
        message: "Install the always-on rules and the design watch? (adds one import line to CLAUDE.md)",
        initialValue: true,
      }),
    ),
    commands: ask(
      await p.confirm({ message: "Install the /unslop-awwwards and /unslop-scout commands?", initialValue: true }),
    ),
  };
}

const t = targets(plan.scope);
const lines = [];
const log = (status, what) => lines.push(`${pc.dim(status.padEnd(8))} ${what}`);

if (plan.skills.length) installSkills(plan.skills, t, log);
if (plan.commands) installCommands(t, log);
if (plan.rules) installRules(t, log);

const next = [
  "Start a new Claude Code session so everything loads.",
  plan.commands && "/unslop-awwwards <brief> builds a site; /unslop-scout refreshes the design watch.",
  "The watch and the render scripts need Playwright: npx playwright install chromium",
  "Run npx unslop-kit@latest again to update. Your design watch is never overwritten.",
].filter(Boolean);

if (flagged) {
  console.log([...lines, "", ...next].join("\n"));
} else {
  p.note(lines.join("\n") || "Nothing selected.", "Installed");
  p.outro(next.join("\n"));
}
