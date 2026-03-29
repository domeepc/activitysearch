// Client-side only Ably client initialization
// Using dynamic import to prevent SSR bundling issues

interface AblyConnection {
  close: () => void;
  state: string;
  on: (event: string | string[], callback: (...args: unknown[]) => void) => void;
  off: (event: string | string[], callback: (...args: unknown[]) => void) => void;
}

interface AblyRealtime {
  connection: AblyConnection;
  channels: {
    get: (name: string) => unknown;
  };
  clientId?: string;
  close?: () => void;
  connect?: () => void;
  auth?: unknown;
  [key: string]: unknown;
}

interface AblyRealtimeConstructor {
  new (config: {
    key?: string;
    clientId?: string;
    authCallback?: (
      tokenParams: unknown,
      callback: (error: Error | string | null, tokenRequest?: unknown) => void
    ) => void;
  }): AblyRealtime;
}

interface AblyModule {
  Realtime: AblyRealtimeConstructor;
  [key: string]: unknown;
}

let ablyClient: AblyRealtime | null = null;
let currentClientId: string | undefined = undefined;
let ablyModulePromise: Promise<AblyModule | null> | null = null;

function loadAblyModule() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (ablyModulePromise) {
    return ablyModulePromise;
  }

  ablyModulePromise = import("ably")
    .then((module) => {
      return module as unknown as AblyModule;
    })
    .catch((error) => {
      console.error("Failed to load Ably:", error);
      return null;
    });

  return ablyModulePromise;
}

/**
 * @param userId Convex user id (must match token clientId from server)
 * @param fetchTokenRequest Convex action that returns Ably token request JSON
 */
export async function getAblyClient(
  userId: string,
  fetchTokenRequest: () => Promise<unknown>
): Promise<AblyRealtime | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!userId) {
    return null;
  }

  if (ablyClient && currentClientId === userId) {
    return ablyClient;
  }

  if (ablyClient && currentClientId !== userId) {
    ablyClient.connection.close();
    ablyClient = null;
    currentClientId = undefined;
  }

  const AblyModule = await loadAblyModule();
  if (!AblyModule) {
    return null;
  }

  try {
    ablyClient = new AblyModule.Realtime({
      authCallback: (_tokenParams, callback) => {
        fetchTokenRequest()
          .then((tokenRequest) => {
            callback(null, tokenRequest);
          })
          .catch((error) => {
            callback(
              error instanceof Error ? error : new Error(String(error)),
              null
            );
          });
      },
      clientId: userId,
    });
    currentClientId = userId;
    return ablyClient;
  } catch (error) {
    console.error("Failed to initialize Ably client:", error);
    return null;
  }
}

export function disconnectAbly() {
  if (ablyClient) {
    ablyClient.connection.close();
    ablyClient = null;
    currentClientId = undefined;
  }
}
