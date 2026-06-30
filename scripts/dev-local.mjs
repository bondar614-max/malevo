import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const rootDir = new URL("..", import.meta.url);
const baseEnv = { ...process.env, ...readDotEnv(new URL(".env", rootDir)) };

const processes = [
  {
    name: "api",
    args: ["--filter", "@workspace/api-server", "run", "dev"],
    env: {
      PORT: "5001",
      NODE_ENV: "development",
    },
  },
  {
    name: "web",
    args: ["--filter", "@workspace/web", "run", "dev"],
    env: {
      PORT: "5173",
      BASE_PATH: "/",
      API_PROXY_TARGET: "http://localhost:5001",
    },
  },
];

const children = processes.map(({ name, args, env: processEnv }) => {
  const child = spawn("pnpm", args, {
    cwd: rootDir,
    env: { ...baseEnv, ...processEnv },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      return;
    }

    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
      stopAll();
      process.exitCode = code ?? 1;
    }
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

function readDotEnv(fileUrl) {
  if (!existsSync(fileUrl)) {
    return {};
  }

  const values = {};
  for (const line of readFileSync(fileUrl, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    values[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
