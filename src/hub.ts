import { expose } from "postmsg-rpc";
type HubOptions = {
  postMessage?: typeof window.postMessage;
};

type Hub = {};
export enum ApiMethods {
  LocalStorage_SetItem = "localStorage.setItem",
  LocalStorage_GetItem = "localStorage.getItem",
  LocalStorage_RemoveItem = "localStorage.removeItem",
  LocalStorage_Clear = "localStorage.clear",
  LocalStorage_Key = "localStorage.key",
}
export function constructHub(options: HubOptions = {}): Hub {
  console.log("constructHub options:", options);
  const hubService = {
    [ApiMethods.LocalStorage_SetItem]: (key: string, value: string) =>
      localStorage.setItem(key, value),

    [ApiMethods.LocalStorage_GetItem]: (key: string) =>
      localStorage.getItem(key),

    [ApiMethods.LocalStorage_RemoveItem]: (key: string) =>
      localStorage.removeItem(key),

    [ApiMethods.LocalStorage_Clear]: () => localStorage.clear(),

    [ApiMethods.LocalStorage_Key]: (index: number) => localStorage.key(index),
  };

  for (const [methodName, methodImpl] of Object.entries(hubService)) {
    expose(methodName, methodImpl, options);
  }
  return {};
}
