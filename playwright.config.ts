import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { createE2eWorkspace } from "./e2e/helpers/workspace";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const materialsDir = createE2eWorkspace(rootDir);
process.env.E2E_MATERIALS_DIR = materialsDir;

function resolvePython(): string {
  const venvWin = path.join(rootDir, ".venv", "Scripts", "python.exe");
  const venvUnix = path.join(rootDir, ".venv", "bin", "python");
  if (process.platform === "win32" && fs.existsSync(venvWin)) {
    return venvWin;
  }
  if (fs.existsSync(venvUnix)) {
    return venvUnix;
  }
  return process.env.PLAYWRIGHT_PYTHON ?? "python";
}

const python = resolvePython();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `"${python}" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`,
    cwd: rootDir,
    url: "http://127.0.0.1:8000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      MATERIALS_DIR: materialsDir,
    },
  },
});
