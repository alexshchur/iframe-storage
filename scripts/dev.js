#!/usr/bin/env node
const { spawn } = require("child_process");

function run(cmd, args, name) {
  const p = spawn(cmd, args, { stdio: "pipe", shell: false });
  p.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  p.on("exit", (code, signal) => {
    console.log(
      `[${name}] exited with code ${code}${signal ? ` signal ${signal}` : ""}`
    );
    // If any process exits, shut down all
    process.exitCode = process.exitCode || code || 1;
    shutdown();
  });
  return p;
}

let procs = [];
function shutdown() {
  for (const p of procs) {
    try {
      p.kill("SIGINT");
    } catch {}
    try {
      p.kill("SIGTERM");
    } catch {}
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

procs.push(run("npm", ["run", "build:watch"], "build"));
procs.push(
  run(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "serve",
      "-l",
      "5001",
      "--no-port-switching",
      "-n",
      "-c",
      "configs/serve.hub.json",
      ".",
    ],
    "hub"
  )
);
procs.push(
  run(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "serve",
      "-l",
      "5000",
      "--no-port-switching",
      "-n",
      "-c",
      "configs/serve.client.json",
      ".",
    ],
    "client"
  )
);

// Keep process alive
setInterval(() => {}, 1 << 30);
