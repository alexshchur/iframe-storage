import { constructClient } from "../client";
import { initHub } from "../hub";
import {
  createHandshakeMessage,
  HANDSHAKE_REQUEST_TYPE,
  HANDSHAKE_RESPONSE_TYPE,
  isHandshakeMessage,
} from "../utils/handshake";
import { withClientHubSandbox } from "./helpers/client-hub-sandbox";

describe("client and hub realistic communication", () => {
  it("performs storage RPC roundtrips via postMessage", async () => {
    await withClientHubSandbox(async ({ iframeId, child, runInChild }) => {
      runInChild(() => initHub());

      const client = constructClient({
        iframe: {
          id: iframeId,
          iframeReadyTimeoutMs: 500,
          messagingOptions: {
            // enableLog: "both",
          },
        },
      });

      await client.localStorage.setItem("foo", "bar");
      expect(child.localStorage.getItem("foo")).toBe("bar");

      await expect(client.localStorage.getItem("foo")).resolves.toBe("bar");
      await client.localStorage.removeItem("foo");
      expect(child.localStorage.getItem("foo")).toBeNull();

      await client.indexedDBKeyval?.set("key", "value");
      await expect(client.indexedDBKeyval?.get("key")).resolves.toBe("value");
      await client.indexedDBKeyval?.del("key");
      await expect(client.indexedDBKeyval?.get("key")).resolves.toBeUndefined();
    });
  });

  it("rejects calls when the hub iframe never initializes", async () => {
    await withClientHubSandbox(async ({ iframeId }) => {
      const client = constructClient({
        iframe: { id: iframeId, iframeReadyTimeoutMs: 40 },
      });

      await expect(
        client.localStorage.setItem("delayed", "value")
      ).rejects.toThrow(
        'Iframe storage hub did not initialize within the allowed time before calling method "localStorage.setItem". Waited 40ms.'
      );
    });
  });

  it("rejects calls when the hub never answers RPC messages", async () => {
    await withClientHubSandbox(async ({ iframeId, runInChild }) => {
      runInChild(() => {
        addEventListener("message", (event) => {
          if (
            event.source === window.parent &&
            isHandshakeMessage(event.data, HANDSHAKE_REQUEST_TYPE)
          ) {
            window.parent.postMessage(
              createHandshakeMessage(HANDSHAKE_RESPONSE_TYPE),
              event.origin
            );
          }
        });
      });

      const client = constructClient({
        iframe: {
          id: iframeId,
          iframeReadyTimeoutMs: 50,
          methodCallTimeoutMs: 30,
        },
      });

      await expect(
        client.localStorage.getItem("never-answers")
      ).rejects.toThrow(
        'Iframe storage hub did not respond to method "localStorage.getItem". Waited 30ms.'
      );
    });
  });
});
