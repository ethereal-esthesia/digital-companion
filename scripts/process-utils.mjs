import { execFileSync } from "node:child_process";

const SHUTDOWN_TIMEOUT_MS = 2500;

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}

function parsePids(output) {
  return output
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findPortPidsWithLsof(port) {
  return parsePids(commandOutput("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"]));
}

function findPortPidsWithFuser(port) {
  return parsePids(commandOutput("fuser", [`${port}/tcp`]));
}

function findPortPidsWithSs(port) {
  const output = commandOutput("ss", ["-H", "-ltnp", `sport = :${port}`]);
  const pids = [];
  const pidPattern = /pid=(\d+)/g;
  let match;

  while ((match = pidPattern.exec(output)) !== null) {
    pids.push(Number(match[1]));
  }

  return pids.filter(Number.isFinite);
}

export function findPortPids(port) {
  const seen = new Set();
  const pids = [
    ...findPortPidsWithLsof(port),
    ...findPortPidsWithFuser(port),
    ...findPortPidsWithSs(port)
  ];

  return pids.filter((pid) => {
    if (seen.has(pid)) {
      return false;
    }
    seen.add(pid);
    return true;
  });
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

export async function killPort(port, options = {}) {
  const pids = findPortPids(port);
  const timeoutMs = options.timeoutMs || SHUTDOWN_TIMEOUT_MS;

  if (pids.length === 0) {
    if (options.reportEmpty) {
      console.log(`No existing server found on ${port}.`);
    }
    return;
  }

  console.log(`Stopping ${pids.length} process(es) on port ${port}: ${pids.join(", ")}`);

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process may have exited between port discovery and kill.
    }
  }

  if (await waitForExit(pids, timeoutMs)) {
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
