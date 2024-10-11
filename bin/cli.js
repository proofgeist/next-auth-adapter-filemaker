#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args[0] === "install-addon") {
  const scriptPath = path.resolve(__dirname, "install-addon.js");

  const child = spawn("node", [scriptPath], { stdio: "inherit" });

  child.on("exit", (code) => {
    process.exit(code);
  });
} else {
  console.log("Unknown command. Available commands: install-addon");
  process.exit(1);
}
