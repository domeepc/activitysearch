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
    console.warn("getAblyClient: No userId provided");
    return null;
  }

  // If client exists and userId hasn't changed, check if it's still valid
  if (ablyClient && currentClientId === userId) {
    // Check if connection is still valid
    const state = ablyClient.connection.state;
    if (state === "connected" || state === "connecting" || state === "initialized") {
      console.log(`Reusing existing Ably client for ${userId}, state: ${state}`);
      return ablyClient;
    } else {
      // Connection is in a bad state, recreate it
      console.warn(`Existing Ably client in bad state (${state}), recreating...`);
      try {
        ablyClient.connection.close();
      } catch (e) {
        // Ignore errors when closing
      }
      ablyClient = null;
      currentClientId = undefined;
    }
  }

  // If userId changed, close old client and create new one
  if (ablyClient && currentClientId !== userId) {
    console.log(`UserId changed from ${currentClientId} to ${userId}, closing old client`);
    try {
      ablyClient.connection.close();
    } catch (e) {
      // Ignore errors when closing
    }
    ablyClient = null;
    currentClientId = undefined;
  }

  // Load Ably module
  console.log(`Loading Ably module for userId: ${userId}`);
  const AblyModule = await loadAblyModule();
  if (!AblyModule) {
    console.error("Failed to load Ably module");
    return null;
  }

  try {
    console.log(`Creating new Ably client for userId: ${userId}`);
    ablyClient = new AblyModule.Realtime({
      key: apiKey,
      clientId: userId, // Use user ID as client ID for presence tracking
      log: { level: 2 }, // Enable debug logging (0=silent, 1=error, 2=warn, 3=info, 4=debug)
    });
    
    // Add connection state logging
    ablyClient.connection.on("connecting", () => {
      console.log(`Ably connecting for ${userId}...`);
    });
    
    ablyClient.connection.on("connected", () => {
      console.log(`Ably connected for ${userId}`);
    });
    
    ablyClient.connection.on("disconnected", () => {
      console.warn(`Ably disconnected for ${userId}`);
    });
    
    ablyClient.connection.on("closed", () => {
      console.warn(`Ably closed for ${userId}`);
    });
    
    ablyClient.connection.on("failed", (error: any) => {
      console.error(`Ably connection failed for ${userId}:`, error);
    });
    
    ablyClient.connection.on("suspended", () => {
      console.warn(`Ably connection suspended for ${userId}`);
    });
    
    currentClientId = userId;
    console.log(`Ably client created for ${userId}, initial state: ${ablyClient.connection.state}`);
    return ablyClient;
  } catch (error) {
    console.error("Failed to initialize Ably client:", error);
    return null;
  }
}

export function disconnectAbly() {
  if (ablyClient) {
    try {
      ablyClient.connection.close();
    } catch (e) {
      // Ignore errors
    }
    ablyClient = null;
    currentClientId = undefined;
  }
}

// Force reset the Ably client (useful for debugging stuck connections)
export function resetAblyClient() {
  console.log("Resetting Ably client...");
  disconnectAbly();
  // Also reset the module promise to force reload
  ablyModulePromise = null;
}
