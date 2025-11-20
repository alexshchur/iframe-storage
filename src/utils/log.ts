import { Domain, MessagingOptions } from "../types";

/**
 * Conditional logger with two-level context: domain and action.
 * domain: "client" | "hub"
 * action: method or event name
 */
export function logIfEnabled(
  options: MessagingOptions | undefined,
  domain: Domain,
  action: string,
  ...info: any[]
): void {
  if (!options?.enableLog) return;
  if (options.enableLog !== "both" && options.enableLog !== domain) return;

  console.log(`[iframe-storage:${domain}:${action}]`, ...info);
}
