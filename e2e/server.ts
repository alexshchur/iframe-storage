import express from "express";
import path from "path";
import http from "http";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");
const HUB_HTML_PATH = path.join(PROJECT_ROOT, "hub.html");

const DEFAULT_HUB_HEADERS: Record<string, string> = {
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export const TEST_RESULT_KEY = "__iframeStorageE2EResult__";

export type ServerOptions = {
  hubHeaders?: Record<string, string>;
};

export type RunningServers = {
  clientOrigin: string;
  hubOrigin: string;
  close: () => Promise<void>;
};

export async function startTestServers(
  options: ServerOptions = {}
): Promise<RunningServers> {
  const hubHeaders = { ...DEFAULT_HUB_HEADERS, ...(options.hubHeaders ?? {}) };
  const hubApp = express();
  hubApp.use("/dist", express.static(DIST_DIR));
  hubApp.get("/hub.html", (req, res) => {
    res.set({
      "Cache-Control": "no-store",
      ...hubHeaders,
    });
    res.sendFile(HUB_HTML_PATH);
  });

  const hubServerInfo = await listen(hubApp);
  const hubOrigin = `http://127.0.0.1:${hubServerInfo.port}`;

  const clientApp = express();
  clientApp.use("/dist", express.static(DIST_DIR));
  clientApp.get("/", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("html");
    res.send(renderClientHtml(`${hubOrigin}/hub.html`));
  });

  const clientServerInfo = await listen(clientApp);
  const clientOrigin = `http://127.0.0.1:${clientServerInfo.port}`;

  return {
    clientOrigin,
    hubOrigin,
    close: async () => {
      await Promise.all([
        closeServer(clientServerInfo.server),
        closeServer(hubServerInfo.server),
      ]);
    },
  };
}

function renderClientHtml(hubUrl: string): string {
  const storageKey = "iframe-storage-e2e";
  const storageValue = "value-from-client";
  const iframeTimeoutMs = 700;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <title>Iframe storage e2e</title>
  </head>
  <body>
    <div>Client harness</div>
    <script src="/dist/browser.js"></script>
    <script>
      (function () {
        const HUB_URL = ${JSON.stringify(hubUrl)};
        const RESULT_KEY = ${JSON.stringify(TEST_RESULT_KEY)};
        const STORAGE_KEY = ${JSON.stringify(storageKey)};
        const STORAGE_VALUE = ${JSON.stringify(storageValue)};
        const IFRAME_TIMEOUT_MS = ${iframeTimeoutMs};

        function report(result) {
          window[RESULT_KEY] = result;
        }

        async function run() {
          try {
            const client = IframeStorage.constructClient({
              iframe: {
                src: HUB_URL,
                iframeReadyTimeoutMs: IFRAME_TIMEOUT_MS,
              },
            });
            await client.localStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
            const value = await client.localStorage.getItem(STORAGE_KEY);
            report({ success: true, value });
          } catch (error) {
            const message =
              error && typeof error === "object" && "message" in error
                ? error.message
                : String(error);
            report({ success: false, message });
          }
        }

        run();
      })();
    </script>
  </body>
</html>`;
}

function listen(app: express.Express): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine server address"));
        return;
      }
      resolve({ server, port: address.port });
    });

    server.on("error", (error) => {
      reject(error);
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
