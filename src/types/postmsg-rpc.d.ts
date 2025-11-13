// Minimal type declarations to silence TS7016 for 'postmsg-rpc'.
// Extend these as you learn the real API surface.
// Placed under src/types so it's picked up automatically.

declare module "postmsg-rpc" {
  /** Generic options bag for expose; refine as needed. */
  export interface ExposeOptions {
    [key: string]: any;
  }
  /**
   * Expose a function callable over postMessage RPC.
   * @param name Unique method name.
   * @param handler Implementation invoked remotely.
   * @param options Optional configuration.
   */
  export function expose<T = any>(
    name: string,
    handler: (...args: any[]) => any | Promise<any>,
    options?: ExposeOptions
  ): T;

  export function call<T = any>(name: string, ...args: any[]): Promise<T>;
}
