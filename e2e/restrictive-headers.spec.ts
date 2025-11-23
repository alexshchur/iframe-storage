import { test, expect, Page } from "@playwright/test";
import {
  startTestServers,
  TEST_RESULT_KEY,
  type RunningServers,
  type ServerOptions,
} from "./server";

type TestResult =
  | { success: true; value: string }
  | { success: false; message: string };

async function withServers<T>(
  options: ServerOptions,
  fn: (servers: RunningServers) => Promise<T>
): Promise<T> {
  const servers = await startTestServers(options);
  try {
    return await fn(servers);
  } finally {
    await servers.close();
  }
}

async function readResult(page: Page, origin: string): Promise<TestResult> {
  await page.goto(origin);
  await page.waitForFunction(
    (key) =>
      Boolean((window as unknown as Record<string, unknown>)[key as string]),
    TEST_RESULT_KEY
  );

  return page.evaluate(
    (key) => (window as unknown as Record<string, TestResult>)[key],
    TEST_RESULT_KEY
  );
}

test.describe("iframe hub headers", () => {
  test("allows communication when the hub is explicitly cross-origin friendly", async ({
    page,
  }) => {
    await withServers({}, async ({ clientOrigin }) => {
      const result = await readResult(page, clientOrigin);
      expect(result).toEqual({ success: true, value: "value-from-client" });
    });
  });

  test("fails the handshake if COEP requires corp but the hub is same-origin only", async ({
    page,
  }) => {
    await withServers(
      {
        hubHeaders: {
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      },
      async ({ clientOrigin }) => {
        const result = await readResult(page, clientOrigin);
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.message).toMatch(/initialize|blocked/i);
      }
    );
  });

  test("fails fast when the hub cannot be framed at all", async ({ page }) => {
    await withServers(
      {
        hubHeaders: {
          "Cross-Origin-Resource-Policy": "cross-origin",
          "Cross-Origin-Embedder-Policy": "credentialless",
          "X-Frame-Options": "DENY",
        },
      },
      async ({ clientOrigin }) => {
        const result = await readResult(page, clientOrigin);
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.message).toMatch(/did not initialize/i);
      }
    );
  });
});
