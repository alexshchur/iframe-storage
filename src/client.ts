import { call } from "postmsg-rpc";
type Client = {};
type ClientOptions = {
  hubUrl?: string;
};
export function constructClient(options: ClientOptions = {}): Client {
  const clientService = {
    "localStorage.setItem": (key: string, value: string) => {
      return call("localStorage.setItem", key, value);
    },
    "localStorage.getItem": (key: string) => {
      return call("localStorage.getItem", key);
    },
    "localStorage.removeItem": (key: string) => {
      return call("localStorage.removeItem", key);
    },
    "localStorage.clear": () => {
      return call("localStorage.clear");
    },
    "localStorage.key": (index: number) => {
      return call("localStorage.key", index);
    },
  };
  return {
    ...clientService,
  };
}
