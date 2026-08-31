#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const nodeMajorVersion = Number(process.versions.node.split(".")[0]);
const nodeOptions = (process.env.NODE_OPTIONS || "")
  .split(/\s+/)
  .filter(Boolean);

// Node 25 exposes a partial global localStorage object. Next 15's
// development error overlay treats it as browser storage and crashes while
// rendering errors, so disable that shim only where it exists.
if (
  nodeMajorVersion >= 25 &&
  !nodeOptions.includes("--no-experimental-webstorage")
) {
  nodeOptions.push("--no-experimental-webstorage");
}

const nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
const child = spawn(
  process.execPath,
  [nextBin, "dev", "-p", "3000", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions.join(" "),
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
