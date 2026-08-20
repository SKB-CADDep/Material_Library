import { test as base, expect } from "@playwright/test";
import { getE2eMaterialsDir, resetE2eWorkspace } from "./helpers/workspace";

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";

export const test = base.extend({
  page: async ({ page, request }, use) => {
    resetE2eWorkspace();

    const reopen = await request.post(`${API_BASE}/api/workspace/open`, {
      data: { directory: getE2eMaterialsDir() },
    });
    if (!reopen.ok()) {
      throw new Error(
        `Failed to reopen E2E workspace: ${reopen.status()} ${await reopen.text()}`,
      );
    }

    await use(page);
  },
});

export { expect };
