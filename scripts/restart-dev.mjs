#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 5173;
const SHUTDOWN_TIMEOUT_MS = 2500;

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const index = process.argv.findIndex((arg) => arg === name || arg.startsWith(prefix));

  if (index === -1) {
    return fallback;
  }

  const arg = process.argv[index];
  if (arg.startsWith(prefix)) {
    return arg.slice(prefix.length);
  }

  return process.argv[index + 1] || fallback;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findPortPids(port) {
  try {
    return execFileSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], {
      encoding: "utf8"
    })
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
  } catch {
    return [];
  }
}

async function waitForExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (pids.every((pid) => !pidExists(pid))) {
      return true;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return pids.every((pid) => !pidExists(pid));
}

async function killPort(port) {
  const pids = findPortPids(port);

  if (pids.length === 0) {
    console.log(`No existing server found on ${port}.`);
    return;
  }

  console.log(`Stopping ${pids.length} process(es) on port ${port}: ${pids.join(", ")}`);

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process may have exited between lsof and kill.
    }
  }

  if (await waitForExit(pids, SHUTDOWN_TIMEOUT_MS)) {
    return;
  }

  const remaining = pids.filter(pidExists);
  if (remaining.length > 0) {
    console.log(`Force stopping process(es): ${remaining.join(", ")}`);
    for (const pid of remaining) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Nothing left to kill.
      }
    }
  }
}

function viteCommand() {
  const vitePath = fileURLToPath(
    new URL(
      process.platform === "win32" ? "../node_modules/.bin/vite.cmd" : "../node_modules/.bin/vite",
      import.meta.url
    )
  );

  return existsSync(vitePath) ? vitePath : "vite";
}

const host = readOption("--host", process.env.HOST || DEFAULT_HOST);
const port = Number(readOption("--port", process.env.PORT || DEFAULT_PORT));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${port}`);
  process.exit(1);
}

await killPort(port);

console.log("Building production bundle...");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);

console.log(`Starting Vite on http://${host}:${port}/`);
const child = spawn(viteCommand(), ["--host", host, "--port", String(port), "--strictPort"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});
