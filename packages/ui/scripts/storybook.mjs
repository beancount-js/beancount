import { spawn } from "node:child_process";
const prepare = spawn("pnpm", ["prepare:dependencies"], { stdio: "inherit" });
const status = await new Promise((resolve) => prepare.on("exit", resolve));
if (status !== 0) process.exit(status ?? 1);
const child = spawn(
  "pnpm",
  [
    "exec",
    "storybook",
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    process.env.BEANCOUNT_STORYBOOK_PORT ?? "6006",
    "--exact-port",
    "--no-open",
    "--config-dir",
    ".storybook",
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
