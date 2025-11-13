import { expose } from "postmsg-rpc";
type HubOptions = {
  url?: string;
};

type Hub = {};
export function constructHub(options: HubOptions = {}): Hub {
  const hubService = {
    "localStorage.setItem": (key: string, value: string) => {
      return localStorage.setItem(key, value);
    },
    "localStorage.getItem": (key: string) => {
      return localStorage.getItem(key);
    },
    "localStorage.removeItem": (key: string) => {
      return localStorage.removeItem(key); //
    },
    "localStorage.clear": () => {
      return localStorage.clear();
    },
    "localStorage.key": (index: number) => {
      return localStorage.key(index); //
    },
  };

  for (const [methodName, methodImpl] of Object.entries(hubService)) {
    expose(methodName, methodImpl);
  }
  return {};
}
