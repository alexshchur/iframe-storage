import { caller } from "postmsg-rpc";
import { ApiMethods } from "./hub";
import { MessagingOptions } from "./types";
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

  return {
    localStorage: {
      setItem: (key: string, value: string) =>
        caller(ApiMethods.LocalStorage_SetItem, callerOptions)(
          key,
          value,
          messagingOptions
        ),

      getItem: (key: string) =>
        caller(ApiMethods.LocalStorage_GetItem, callerOptions)(
          key,
          messagingOptions
        ),

      removeItem: (key: string) =>
        caller(ApiMethods.LocalStorage_RemoveItem, callerOptions)(
          key,
          messagingOptions
        ),

      clear: () =>
        caller(ApiMethods.LocalStorage_Clear, callerOptions)(messagingOptions),

      key: (index: number) =>
        caller(ApiMethods.LocalStorage_Key, callerOptions)(
          index,
          messagingOptions
        ),
    },

    indexedDBKeyval: {
      set: (key: string, value: string) =>
        caller(ApiMethods.indexDBKeyval_Set, callerOptions)(
          key,
          value,
          messagingOptions
        ),

      get: (key: string) =>
        caller(ApiMethods.indexDBKeyval_Get, callerOptions)(
          key,
          messagingOptions
        ),

      del: (key: string) =>
        caller(ApiMethods.indexDBKeyval_Del, callerOptions)(
          key,
          messagingOptions
        ),
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
