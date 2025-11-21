import { caller } from "postmsg-rpc";
import { ApiMethods } from "./hub";
import { MessagingOptions } from "./types";
import {
  createHandshakeMessage,
  HANDSHAKE_REQUEST_TYPE,
  HANDSHAKE_RESPONSE_TYPE,
  isHandshakeMessage,
} from "./utils/handshake";
import { logIfEnabled } from "./utils/log";
type Client = {
  localStorage: {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    key: (index: number) => Promise<string | null>;
  };

  indexedDBKeyval?: {
    set: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | undefined>;
    del: (key: string) => Promise<void>;
  };
};

const DEFAULT_IFRAME_ID = "iframe-storage-hub";
type ClientOptions = {
  iframe:
    | {
        src: string;
        messagingOptions?: MessagingOptions;
      }
    | {
        id: string;
        messagingOptions?: MessagingOptions;
      };
};

export function constructClient({ iframe }: ClientOptions): Client {
  const { messagingOptions } = iframe;
  const { postMessage, ready } = createIframePostMessage(iframe);
  const callerOptions = { postMessage };

  // Unified dynamic caller to reduce repetition.
  const callerWithOptions = (method: ApiMethods, ...args: any[]) => {
    // log a an intent to call a fn (even if it fails later)
    logIfEnabled(
      messagingOptions,
      "client",
      method,
      "before-postmessage",
      args
    );

    // before calling make sure iframe is inited
    return ready.then(() =>
      caller(method, callerOptions)(...args, messagingOptions)
    );
  };

  // for debug purposes
  addEventListener("message", (event) => {
    const sender = event.data.sender;

    if ("postmsg-rpc/server" !== sender) return;

    if (
      messagingOptions?.enableLog !== "client" &&
      messagingOptions?.enableLog !== "both"
    )
      return;

    const id = event.data?.id || "unknown_id";

    logIfEnabled(messagingOptions, "client", id, `response`, event);
  });

  return {
    localStorage: {
      setItem: (key: string, value: string) =>
        callerWithOptions(ApiMethods.LocalStorage_SetItem, key, value),

      getItem: (key: string) =>
        callerWithOptions(ApiMethods.LocalStorage_GetItem, key),

      removeItem: (key: string) =>
        callerWithOptions(ApiMethods.LocalStorage_RemoveItem, key),

      clear: () => callerWithOptions(ApiMethods.LocalStorage_Clear),

      key: (index: number) =>
        callerWithOptions(ApiMethods.LocalStorage_Key, index),
    },
    indexedDBKeyval: {
      set: (key: string, value: string) =>
        callerWithOptions(ApiMethods.indexDBKeyval_Set, key, value),

      get: (key: string) =>
        callerWithOptions(ApiMethods.indexDBKeyval_Get, key),

      del: (key: string) =>
        callerWithOptions(ApiMethods.indexDBKeyval_Del, key),
    },
  };
}

function createIframePostMessage(iframeOptions: ClientOptions["iframe"]): {
  postMessage: typeof window.postMessage;
  ready: Promise<void>;
} {
  const iframe =
    "src" in iframeOptions
      ? getOrCreateIframe(iframeOptions.src)
      : getExistingIframe(iframeOptions.id);
  const { contentWindow } = iframe;

  if (!contentWindow) {
    throw new Error("Injected iframe is missing a contentWindow reference.");
  }

  return {
    postMessage: contentWindow.postMessage.bind(contentWindow),
    ready: waitForHubReady(iframe),
  };
}

function getOrCreateIframe(iframeSrc: string): HTMLIFrameElement {
  if (typeof document === "undefined") {
    throw new Error("Cannot inject iframe: document is not available.");
  }

  const doc = document;
  const existing = doc.getElementById(DEFAULT_IFRAME_ID);

  if (existing && !(existing instanceof HTMLIFrameElement)) {
    throw new Error(
      `Element with id "${DEFAULT_IFRAME_ID}" already exists and is not an iframe.`
    );
  }

  const iframe = existing ?? doc.createElement("iframe");
  iframe.id = DEFAULT_IFRAME_ID;
  iframe.src = iframeSrc;

  if (!existing) {
    hideIframe(iframe);
    if (!doc.body) {
      throw new Error("Cannot inject iframe: document.body is not available.");
    }

    doc.body.appendChild(iframe);
  }

  return iframe;
}

function getExistingIframe(iframeId: string): HTMLIFrameElement {
  if (typeof document === "undefined") {
    throw new Error("Cannot access iframe: document is not available.");
  }

  const existing = document.getElementById(iframeId);

  if (!existing) {
    throw new Error(`Iframe with id "${iframeId}" was not found.`);
  }

  if (!(existing instanceof HTMLIFrameElement)) {
    throw new Error(`Element with id "${iframeId}" is not an iframe.`);
  }

  return existing;
}

function hideIframe(iframe: HTMLIFrameElement): void {
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
}

const IFRAME_READY_TIMEOUT_MS = 20000;
const IFRAME_READY_PING_INTERVAL_MS = 250;
const iframeReadyPromises = new WeakMap<HTMLIFrameElement, Promise<void>>();

function waitForHubReady(iframe: HTMLIFrameElement): Promise<void> {
  const existing = iframeReadyPromises.get(iframe);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const { contentWindow } = iframe;

    if (!contentWindow) {
      reject(
        new Error("Cannot determine iframe readiness: missing contentWindow.")
      );
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== contentWindow) return;
      if (!isHandshakeMessage(event.data, HANDSHAKE_RESPONSE_TYPE)) return;
      cleanup();
      resolve();
    };

    const sendPing = () => {
      const message = createHandshakeMessage(HANDSHAKE_REQUEST_TYPE);
      // Use "*" to avoid origin mismatches while the iframe is still running
      // about:blank before the remote hub document takes over.
      contentWindow.postMessage(message, "*");
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for iframe "${
            iframe.id || iframe.src
          }" to finish loading.`
        )
      );
    }, IFRAME_READY_TIMEOUT_MS);

    const intervalId = window.setInterval(
      sendPing,
      IFRAME_READY_PING_INTERVAL_MS
    );

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };

    window.addEventListener("message", handleMessage);
    sendPing();
  });

  iframeReadyPromises.set(iframe, promise);
  return promise;
}
