import { expose } from "postmsg-rpc";
import { get, set, del } from "idb-keyval";

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

  for (const [methodName, methodImpl] of Object.entries(hubService)) {
    expose(methodName, methodImpl, {
      postMessage: window.parent.postMessage.bind(window.parent),
    });
  }
}
