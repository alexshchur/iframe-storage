type HubOptions = {
  url: string;
};

type Hub = {};
export function constructHub(options: HubOptions): Hub {
  return {};
}

type Client = {};
type ClientOptions = {
  hubUrl: string;
};
export function constructClient(options: ClientOptions): Client {
  return {};
}
