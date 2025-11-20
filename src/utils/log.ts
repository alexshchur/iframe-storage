import type { ApiMethods } from "../hub";
import { Domain, MessagingOptions } from "../types";

/**
 * Conditional logger with two-level context: domain and action.
 * domain: "client" | "hub"
 * action: ApiMethods (method name)
 */
export function logIfEnabled(
  options: MessagingOptions | undefined,
  domain: Domain,
  action: ApiMethods,
  ...info: unknown[]
): void {
  if (!options?.enableLog) return;
  if (options.enableLog !== "both" && options.enableLog !== domain) return;

  console.log(`[iframe-storage:${domain}:${action}]`, ...info);
}
