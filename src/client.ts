import { caller } from "postmsg-rpc";
import { ApiMethods } from "./hub";
import { MessagingOptions } from "./types";
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
  iframe: {
    src: string;
    messagingOptions?: MessagingOptions;
  };
};

export function constructClient({
  iframe: { src: iframeSrc, messagingOptions },
}: ClientOptions): Client {
  const postMessage = createIframePostMessage(iframeSrc);
  const callerOptions = { postMessage };

  // Unified dynamic caller to reduce repetition.
  const callerWithOptions = (method: ApiMethods, ...args: any[]) => {
    logIfEnabled(messagingOptions, "client", method, args);
    return caller(method, callerOptions)(...args, messagingOptions);
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

function createIframePostMessage(iframeSrc: string): typeof window.postMessage {
  const iframe = getOrCreateIframe(iframeSrc);
  const { contentWindow } = iframe;

  if (!contentWindow) {
    throw new Error("Injected iframe is missing a contentWindow reference.");
  }

  return contentWindow.postMessage.bind(contentWindow);
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

function hideIframe(iframe: HTMLIFrameElement): void {
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
}
