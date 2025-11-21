const HANDSHAKE_NAMESPACE = "iframe-storage:hub-ready";

export const HANDSHAKE_REQUEST_TYPE = `${HANDSHAKE_NAMESPACE}:request`;
export const HANDSHAKE_RESPONSE_TYPE = `${HANDSHAKE_NAMESPACE}:response`;

export type HandshakeMessage =
  | {
      __iframeStorageHandshake: true;
      type: typeof HANDSHAKE_REQUEST_TYPE;
    }
  | {
      __iframeStorageHandshake: true;
      type: typeof HANDSHAKE_RESPONSE_TYPE;
    };

export function createHandshakeMessage(
  type: HandshakeMessage["type"]
): HandshakeMessage {
  return {
    __iframeStorageHandshake: true,
    type,
  };
}

export function isHandshakeMessage(
  data: unknown,
  type?: HandshakeMessage["type"]
): data is HandshakeMessage {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as Record<string, unknown>).__iframeStorageHandshake !== true
  ) {
    return false;
  }

  if (!type) {
    return true;
  }

  return (data as HandshakeMessage).type === type;
}
