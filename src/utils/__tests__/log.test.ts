import { ApiMethods } from "../../hub";
import { logIfEnabled } from "../log";

describe("logIfEnabled", () => {
  const originalLog = console.log;

  beforeEach(() => {
    console.log = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it("logs when the domain matches the enabled option", () => {
    logIfEnabled(
      { enableLog: "client" },
      "client",
      ApiMethods.LocalStorage_SetItem,
      {
        payload: "value",
      }
    );

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      "[iframe-storage:client:localStorage.setItem]",
      { payload: "value" }
    );
  });

  it("does not log when logging is disabled or domain does not match", () => {
    logIfEnabled(undefined, "client", ApiMethods.LocalStorage_GetItem);
    logIfEnabled({ enableLog: "hub" }, "client", "response");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("logs for both domains when enableLog is set to both", () => {
    logIfEnabled({ enableLog: "both" }, "hub", "response", "ok");
    logIfEnabled(
      { enableLog: "both" },
      "client",
      ApiMethods.LocalStorage_GetItem,
      "key"
    );

    expect(console.log).toHaveBeenCalledTimes(2);
  });
});
