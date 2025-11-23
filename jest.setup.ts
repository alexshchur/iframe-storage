import { TextDecoder, TextEncoder } from "util";
import "fake-indexeddb/auto";

declare global {
  // eslint-disable-next-line no-var
  var TextEncoder: typeof TextEncoder | undefined;
  // eslint-disable-next-line no-var
  var TextDecoder: typeof TextDecoder | undefined;
}

if (typeof globalThis.TextEncoder === "undefined") {
  (
    globalThis as typeof globalThis & {
      TextEncoder: typeof TextEncoder;
    }
  ).TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  (
    globalThis as typeof globalThis & {
      TextDecoder: typeof TextDecoder;
    }
  ).TextDecoder = TextDecoder;
}
