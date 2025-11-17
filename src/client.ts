import { caller } from "postmsg-rpc";
import { ApiMethods } from "./hub";
type Client = {
  localStorage: {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    key: (index: number) => Promise<string | null>;
  };
};
type ClientOptions = {
  postMessage?: typeof window.postMessage;
};

export function constructClient(options?: ClientOptions): Client {
  return {
    localStorage: {
      setItem: (key: string, value: string) =>
        caller(ApiMethods.LocalStorage_SetItem, options)(key, value),

      getItem: (key: string) =>
        caller(ApiMethods.LocalStorage_GetItem, options)(key),

      removeItem: (key: string) =>
        caller(ApiMethods.LocalStorage_RemoveItem, options)(key),

      clear: () => caller(ApiMethods.LocalStorage_Clear, options)(),

      key: (index: number) =>
        caller(ApiMethods.LocalStorage_Key, options)(index),
    },
  };
}
