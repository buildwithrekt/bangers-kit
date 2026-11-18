#!/usr/bin/env node
// Entry point for the plugin's /unsl0p:setup. No npm dependencies, so it runs straight from the plugin folder.
import { installRules, targets } from "./lib/install.mjs";

const log = (status, what) => console.log(`${status.padEnd(8)} ${what}`);
installRules(targets("global"), log);
console.log("done. Start a new session to load the rules.");
