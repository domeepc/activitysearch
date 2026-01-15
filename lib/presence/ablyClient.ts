// Client-side only Ably client initialization
// Using dynamic import to prevent SSR bundling issues

let ablyClient: any = null;
let currentClientId: string | undefined = undefined;
let ablyModulePromise: Promise<any> | null = null;

function loadAblyModule() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (ablyModulePromise) {
    return ablyModulePromise;
  }

  ablyModulePromise = import("ably").then((module) => {
    // Use the browser build by accessing the default export or Realtime directly
    return module;
  }).catch((error) => {
    console.error("Failed to load Ably:", error);
    return null;
  });

  return ablyModulePromise;
}

export async function getAblyClient(userId?: string): Promise<any> {
  if (typeof window === "undefined") {
    // Server-side: return null
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;
  if (!apiKey) {
    console.warn("NEXT_PUBLIC_ABLY_API_KEY is not set. Presence features will be disabled.");
    return null;
  }

  if (!userId) {
    return null;
  }

  // If client exists and userId hasn't changed, return existing client
  if (ablyClient && currentClientId === userId) {
    return ablyClient;
  }

  // If userId changed, close old client and create new one
  if (ablyClient && currentClientId !== userId) {
    ablyClient.connection.close();
    ablyClient = null;
    currentClientId = undefined;
  }

  // Load Ably module
  const AblyModule = await loadAblyModule();
  if (!AblyModule) {
    return null;
  }

  try {
    ablyClient = new AblyModule.Realtime({
      key: apiKey,
      clientId: userId, // Use user ID as client ID for presence tracking
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
