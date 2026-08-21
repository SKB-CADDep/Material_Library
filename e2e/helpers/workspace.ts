import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_SOURCE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "tests",
  "fixtures",
  "workspace_min",
);

function copyFixtureJsonFiles(sourceDir: string, targetDir: string): number {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Fixture workspace not found: ${sourceDir}`);
  }

  let jsonCount = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      fs.copyFileSync(
        path.join(sourceDir, entry.name),
        path.join(targetDir, entry.name),
      );
      jsonCount += 1;
    }
  }

  if (jsonCount === 0) {
    throw new Error(`No JSON files copied to E2E workspace: ${targetDir}`);
  }

  return jsonCount;
}

export function getE2eMaterialsDir(): string {
  const dir = process.env.E2E_MATERIALS_DIR;
  if (!dir) {
    throw new Error("E2E_MATERIALS_DIR is not set (run via playwright.config.ts)");
  }
  return dir;
}

export function createE2eWorkspace(rootDir: string): string {
  const sourceDir = path.join(rootDir, "tests", "fixtures", "workspace_min");
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "ml-e2e-"));
  copyFixtureJsonFiles(sourceDir, targetDir);
  return targetDir;
}


export function resetE2eWorkspace(): void {
  const targetDir = getE2eMaterialsDir();

  for (const name of fs.readdirSync(targetDir)) {
    if (name.toLowerCase().endsWith(".json")) {
      fs.unlinkSync(path.join(targetDir, name));
    }
  }

  copyFixtureJsonFiles(FIXTURE_SOURCE_DIR, targetDir);
}
