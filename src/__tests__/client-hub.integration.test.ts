import { JSDOM } from "jsdom";

import { constructClient } from "../client";
import { initHub } from "../hub";

const IFRAME_ID = "integration-frame";

type WindowLike = Window & typeof globalThis;

const WINDOW_KEYS = [
  "window",
  "self",
  "document",
  "navigator",
  "addEventListener",
  "removeEventListener",
  "MessageEvent",
  "Event",
  "CustomEvent",
  "HTMLElement",
  "HTMLIFrameElement",
  "HTMLBodyElement",
  "EventTarget",
  "Node",
  "DOMException",
  "performance",
  "getComputedStyle",
] as const;

let currentWindow: WindowLike | undefined;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get() {
    return currentWindow?.localStorage;
  },
});

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  get() {
    return currentWindow?.sessionStorage;
  },
});

type WindowSnapshot = {
  values: Partial<Record<(typeof WINDOW_KEYS)[number], unknown>>;
  currentWindow?: WindowLike;
};

function captureSnapshot(): WindowSnapshot {
  const values: Partial<Record<(typeof WINDOW_KEYS)[number], unknown>> = {};
  for (const key of WINDOW_KEYS) {
    values[key] = (globalThis as Record<string, unknown>)[key];
  }
  return { values, currentWindow };
}

function applyWindow(win: WindowLike) {
  for (const key of WINDOW_KEYS) {
    (globalThis as Record<string, unknown>)[key] = (win as Record<
      string,
      unknown
    >)[key];
  }
  currentWindow = win;
}

function restoreWindow(snapshot: WindowSnapshot) {
  for (const key of WINDOW_KEYS) {
    (globalThis as Record<string, unknown>)[key] = snapshot.values[key];
  }
  currentWindow = snapshot.currentWindow;
}

function useWindow<T>(win: WindowLike, fn: () => T): T {
  const snapshot = captureSnapshot();
  applyWindow(win);
  try {
    return fn();
  } finally {
    restoreWindow(snapshot);
  }
}

function linkPostMessage(parent: WindowLike, child: WindowLike) {
  const parentPostMessage = parent.postMessage.bind(parent);
  const childPostMessage = child.postMessage.bind(child);

  const forward = (target: WindowLike, source: WindowLike) => {
    return (data: unknown) => {
      setTimeout(() => {
        const event = new target.MessageEvent("message", {
          data,
          origin: source.location.origin,
          source,
        });
        useWindow(target, () => {
          target.dispatchEvent(event);
        });
      }, 0);
    };
  };

  parent.postMessage = forward(parent, child) as Window["postMessage"];
  child.postMessage = forward(child, parent) as Window["postMessage"];

  return () => {
    parent.postMessage = parentPostMessage;
    child.postMessage = childPostMessage;
  };
}

function setupLinkedWindows() {
  const parentDom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://client.test",
    pretendToBeVisual: true,
  });
  const childDom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://hub.test",
    pretendToBeVisual: true,
  });

  const parent = parentDom.window as WindowLike;
  const child = childDom.window as WindowLike;

  Object.defineProperty(child, "parent", {
    configurable: true,
    value: parent,
  });
  Object.defineProperty(parent, "parent", {
    configurable: true,
    value: parent,
  });

  const restorePostMessage = linkPostMessage(parent, child);

  const iframe = parent.document.createElement("iframe");
  iframe.id = IFRAME_ID;
  parent.document.body.appendChild(iframe);

  Object.defineProperty(iframe, "contentWindow", {
    configurable: true,
    value: child,
  });
  Object.defineProperty(iframe, "contentDocument", {
    configurable: true,
    value: child.document,
  });

  const { indexedDB, IDBKeyRange } = globalThis as typeof globalThis & {
    indexedDB: IDBFactory;
    IDBKeyRange: typeof IDBKeyRange;
  };

  Object.assign(parent, { indexedDB, IDBKeyRange });
  Object.assign(child, { indexedDB, IDBKeyRange });

  return {
    parent,
    child,
    cleanup: () => {
      restorePostMessage();
      parent.close();
      child.close();
    },
  };
}

describe("client and hub realistic communication", () => {
  it("performs storage RPC roundtrips via postMessage", async () => {
    const { parent, child, cleanup } = setupLinkedWindows();
    const restoreParent = captureSnapshot();
    applyWindow(parent);

    try {
      useWindow(child, () => initHub());

      const client = constructClient({
        iframe: { id: IFRAME_ID, iframeReadyTimeoutMs: 500 },
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
    } finally {
      restoreWindow(restoreParent);
      cleanup();
    }
  });

  it("rejects calls when the hub iframe never initializes", async () => {
    const { parent, cleanup } = setupLinkedWindows();
    const snapshot = captureSnapshot();
    applyWindow(parent);

    try {
      const client = constructClient({
        iframe: { id: IFRAME_ID, iframeReadyTimeoutMs: 40 },
      });

      await expect(
        client.localStorage.setItem("delayed", "value")
      ).rejects.toThrow(
        'Iframe storage hub did not initialize within the allowed time before calling method "localStorage.setItem". Waited 40ms.'
      );
    } finally {
      restoreWindow(snapshot);
      cleanup();
    }
  });
});
