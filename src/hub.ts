import { expose } from "postmsg-rpc";
import { get, set, del } from "idb-keyval";
import { MessagingOptions } from "./types";
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

  const localStorageMethods = {
    [ApiMethods.LocalStorage_SetItem]: (
      key: string,
      value: string,
      options?: MessagingOptions
    ) => localStorage.setItem(key, value),

    [ApiMethods.LocalStorage_GetItem]: (
      key: string,
      options?: MessagingOptions
    ) => localStorage.getItem(key),

    [ApiMethods.LocalStorage_RemoveItem]: (
      key: string,
      options?: MessagingOptions
    ) => localStorage.removeItem(key),

    [ApiMethods.LocalStorage_Clear]: (options?: MessagingOptions) =>
      localStorage.clear(),

    [ApiMethods.LocalStorage_Key]: (
      index: number,
      options?: MessagingOptions
    ) => localStorage.key(index),
  };

  const indexDBKeyvalMethods = {
    [ApiMethods.indexDBKeyval_Set]: (
      key: string,
      value: string,
      options?: MessagingOptions
    ) => set(key, value),

    [ApiMethods.indexDBKeyval_Get]: (key: string, options?: MessagingOptions) =>
      get(key),

    [ApiMethods.indexDBKeyval_Del]: (key: string, options?: MessagingOptions) =>
      del(key),
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
        return methodImpl(...args);
      },
      {
        postMessage: window.parent.postMessage.bind(window.parent),
      }
    );
  }
}
