import { expose } from "postmsg-rpc";
import { get, set, del } from "idb-keyval";
import { MessagingOptions } from "./types";
import {
  createHandshakeMessage,
  HANDSHAKE_REQUEST_TYPE,
  HANDSHAKE_RESPONSE_TYPE,
  isHandshakeMessage,
} from "./utils/handshake";
import { logIfEnabled } from "./utils/log";

export enum ApiMethods {
  LocalStorage_SetItem = "localStorage.setItem",
  LocalStorage_GetItem = "localStorage.getItem",
  LocalStorage_RemoveItem = "localStorage.removeItem",
  LocalStorage_Clear = "localStorage.clear",
  LocalStorage_Key = "localStorage.key",

  indexDBKeyval_Set = "indexDBKeyval.set",
  indexDBKeyval_Get = "indexDBKeyval.get",
  indexDBKeyval_Del = "indexDBKeyval.del",
}

export function initHub() {
  if (!window?.parent)
    throw new Error("Hub must be run inside an iframe with a parent window.");

  // for debug purposes and readiness handshake
  addEventListener("message", (event) => {
    if (
      event.source === window.parent &&
      isHandshakeMessage(event.data, HANDSHAKE_REQUEST_TYPE)
    ) {
      window.parent.postMessage(
        createHandshakeMessage(HANDSHAKE_RESPONSE_TYPE),
        event.origin
      );
      return;
    }

    const messagingOptions: MessagingOptions | undefined = event.data?.args
      ? event.data.args[event.data.args.length - 1]
      : undefined;

    if (
      messagingOptions?.enableLog !== "hub" &&
      messagingOptions?.enableLog !== "both"
    )
      return;

    const method = event.data?.func || "unknown_method";
    const id = event.data?.id || "unknown_id";
    logIfEnabled(
      messagingOptions,
      "hub",
      `${id}:${method as ApiMethods}`,
      "received_message",
      event
    );
  });
  const localStorageMethods = {
    [ApiMethods.LocalStorage_SetItem]: (key: string, value: string) =>
      localStorage.setItem(key, value),

    [ApiMethods.LocalStorage_GetItem]: (key: string) =>
      localStorage.getItem(key),

    [ApiMethods.LocalStorage_RemoveItem]: (key: string) =>
      localStorage.removeItem(key),

    [ApiMethods.LocalStorage_Clear]: () => localStorage.clear(),

    [ApiMethods.LocalStorage_Key]: (index: number) => localStorage.key(index),
  };

  const indexDBKeyvalMethods = {
    [ApiMethods.indexDBKeyval_Set]: (key: string, value: string) =>
      set(key, value),

    [ApiMethods.indexDBKeyval_Get]: (key: string) => get(key),

    [ApiMethods.indexDBKeyval_Del]: (key: string) => del(key),
    // Note: idb-keyval does not have clear and key methods, so we skip them
  };

  const hubService = {
    ...localStorageMethods,
    ...indexDBKeyvalMethods,
  };

  for (const [methodName, methodImpl] of Object.entries(hubService) as Array<
    [ApiMethods, (...args: unknown[]) => unknown]
  >) {
    expose(
      methodName,
      (...args: unknown[]) => {
        // Avoid Array.prototype.at for broader lib compatibility.
        const maybeOptions = args.length
          ? (args[args.length - 1] as MessagingOptions | undefined)
          : undefined;
        const loggedArgs = maybeOptions ? args.slice(0, args.length - 1) : args;
        logIfEnabled(
          maybeOptions,
          "hub",
          methodName,
          "before_call",
          loggedArgs
        );
        const result = methodImpl(...args);
        logIfEnabled(maybeOptions, "hub", methodName, "after_call", result);
        return result;
      },
      {
        postMessage: window.parent.postMessage.bind(window.parent),
      }
    );
  }
}
