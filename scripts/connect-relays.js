// Connect to Primary Relays Only
const primaryRelays = [
  "wss://nos.lol",
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
  "wss://relay.chorus.community",
];

window.activeRelays = new Set(); // Keep track of active relay connections

const maxReconnectAttempts = 3,
  reconnectDelay = 3000,
  wsConnections = new Map(),
  connectionAttempts = new Map(),
  connectionInProgress = new Map(),
  lastResetTime = Date.now(); // Track connection attempt status for each relay

// Clear all WebSocket connections
const resetConnections = () => {
  wsConnections.forEach((ws) => ws.close());
  wsConnections.clear();
  connectionAttempts.clear();
  connectionInProgress.clear();
};

resetConnections();

// Reconnect delay with exponential backoff
const reconnectDelayFunction = (url, attempts) => {
  const delay = Math.min(reconnectDelay * attempts, 10000);
  console.log(`Reconnecting to ${url} in ${delay / 1000} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Create WebSocket connection with locking mechanism
const createWebSocket = async (url) => {
  if (
    wsConnections.has(url) &&
    wsConnections.get(url)?.readyState === WebSocket.OPEN
  ) {
    return wsConnections.get(url);
  }

  if (connectionInProgress.get(url)) {
    console.log(`Connection in progress for ${url}. Waiting...`);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        clearInterval(checkConnection);
        resolve(null);
      }, 10000);
      const checkConnection = setInterval(() => {
        const ws = wsConnections.get(url);
        if (ws && ws?.readyState === WebSocket.OPEN) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve(ws);
        }
        if (!connectionInProgress.get(url)) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve(null);
        }
      }, 500);
    });
  }

  connectionInProgress.set(url, true);
  let attempts = connectionAttempts.get(url) || 0;
  if (attempts >= maxReconnectAttempts) {
    console.error(`Max reconnection attempts reached for ${url}`);
    connectionInProgress.set(url, false);
    return null;
  }

  connectionAttempts.set(url, attempts + 1);
  console.log(
    `Connecting to ${url}, attempt ${attempts + 1}/${maxReconnectAttempts}`
  );

  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timeoutId = setTimeout(() => {
      ws.close();
      console.error(`Connection timeout for ${url}`);
      connectionInProgress.set(url, false);
      resolve(null);
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeoutId);
      console.log(`Connected to ${url}`);
      wsConnections.set(url, ws);
      window.activeRelays.add(url);
      connectionAttempts.set(url, 0);
      connectionInProgress.set(url, false);
      resolve(ws);
    };

    ws.onerror = () => {
      clearTimeout(timeoutId);
      console.error(`WebSocket error on ${url}`);
      connectionInProgress.set(url, false);
    };

    ws.onclose = () => {
      clearTimeout(timeoutId);
      console.warn(`Connection closed: ${url}`);
      wsConnections.delete(url);
      window.activeRelays.delete(url);
      connectionInProgress.set(url, false);

      if (connectionAttempts.get(url) < maxReconnectAttempts) {
        reconnectDelayFunction(url, connectionAttempts.get(url)).then(() => createWebSocket(url));
      } else {
        console.error(`Failed to reconnect after ${maxReconnectAttempts} attempts: ${url}`);
      }
    };
  });
};

// Initialize relay connections in parallel without blocking
primaryRelays.forEach((url) => createWebSocket(url).catch(() => null));

// Update relay connections based on primary relays
const updateRelays = async () => {
  try {
    for (const [url, ws] of wsConnections.entries()) {
      if (!primaryRelays.includes(url)) {
        console.log(`Closing connection to ${url}`);
        ws.close();
        wsConnections.delete(url);
        connectionAttempts.delete(url);
      }
    }

    const workingConnections = [...wsConnections.entries()]
      .filter(([, ws]) => ws?.readyState === WebSocket.OPEN)
      .map(([url]) => url);

    const connectingPromises = primaryRelays
      .filter((url) => !workingConnections.includes(url))
      .map((url) =>
        Promise.race([
          createWebSocket(url).then(() => url).catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000))
        ])
      );

    const newConnections = (await Promise.allSettled(connectingPromises))
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    window.activeRelays = new Set([
      ...workingConnections,
      ...newConnections.filter(Boolean),
    ]);

    if (!activeRelays.size) {
      for (const url of primaryRelays) {
        const ws = await Promise.race([
          createWebSocket(url),
          new Promise((resolve) => setTimeout(() => resolve(null), 8000))
        ]);
        if (ws) {
          window.activeRelays = new Set([url]);
          break;
        }
      }
    }
  } catch (err) {
    console.error("Error during relay update:", err);
  }
};

updateRelays().catch(console.error);

// Periodic relay maintenance (every 60 seconds)
let isUpdating = false;
setInterval(async () => {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const workingConnections = [...wsConnections.entries()]
      .filter(([, ws]) => ws.readyState === WebSocket.OPEN)
      .map(([url]) => url);
    
    // Reset connection attempts every 5 minutes
    if (Date.now() - lastResetTime > 300000) {
      connectionAttempts.clear();
      lastResetTime = Date.now();
    }
    
    if (!workingConnections.length) await updateRelays();
    window.activeRelays = new Set(workingConnections);
  } catch (err) {
    console.error("Connection maintenance error:", err);
  }
  isUpdating = false;
}, 60000);

// Function for idle timeout
const handleIdleTimeout = () => {
  setTimeout(() => wsConnections.forEach((ws) => ws.close()), 5 * 60 * 1000);
};

// Reconnect on activity
const reconnectOnActivity = () => {
  clearTimeout(window.idleTimeout);
  handleIdleTimeout();
};

["mousemove", "keydown"].forEach((event) =>
  document.addEventListener(event, reconnectOnActivity)
);
