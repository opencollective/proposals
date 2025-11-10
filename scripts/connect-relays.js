// Connect to Primary Relays Only
const primaryRelays = [
  "wss://nos.lol",
  "wss://relay.damus.io",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
];

let activeRelays = new Set(primaryRelays); // Keep track of active relay connections

const maxReconnectAttempts = 2,
  reconnectDelay = 5000,
  wsConnections = new Map(),
  connectionAttempts = new Map(),
  connectionInProgress = new Map(); // Track connection attempt status for each relay

// Clear all WebSocket connections
const resetConnections = () => {
  wsConnections.forEach((ws) => ws.close());
  wsConnections.clear();
  connectionAttempts.clear();
};

resetConnections();

// Reconnect delay with exponential backoff (max delay = maxReconnectAttempts * reconnectDelay)
const reconnectDelayFunction = (url, attempts) => {
  const delay = Math.min(
    reconnectDelay * 2 ** (attempts - 1),
    maxReconnectAttempts * reconnectDelay
  );
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
      const checkConnection = setInterval(() => {
        const ws = wsConnections.get(url);
        if (ws && ws?.readyState === WebSocket.OPEN) {
          clearInterval(checkConnection);
          resolve(ws);
        }
      }, 100);
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

  try {
    const ws = new WebSocket(url);
    let timeoutId = setTimeout(() => {
      ws.close();
      console.error(`Connection timeout for ${url}`);
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeoutId);
      console.log(`Connected to ${url}`);
      wsConnections.set(url, ws);
      activeRelays.add(url);
      connectionAttempts.set(url, 0);
      connectionInProgress.set(url, false);
    };

    ws.onerror = (err) => {
      clearTimeout(timeoutId);
      console.error(`WebSocket error on ${url}:`, err);
      ws.close();
      connectionInProgress.set(url, false);
    };

    ws.onclose = async () => {
      clearTimeout(timeoutId);
      console.warn(`Connection closed: ${url}`);
      wsConnections.delete(url);
      activeRelays.delete(url);
      connectionInProgress.set(url, false);

      if (connectionAttempts.get(url) < maxReconnectAttempts) {
        await reconnectDelayFunction(url, connectionAttempts.get(url));
        await createWebSocket(url);
      } else {
        console.error(
          `Failed to reconnect after ${maxReconnectAttempts} attempts: ${url}`
        );
      }
    };

    return ws;
  } catch (err) {
    console.error(`Error connecting to ${url}:`, err);
    connectionInProgress.set(url, false);
    throw err;
  }
};

// Initialize relay connections
primaryRelays.forEach(createWebSocket);

// Update relay connections based on primary relays
const updateRelays = async () => {
  try {
    // Remove WebSocket connections for relays that are no longer needed
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
        createWebSocket(url)
          .then(() => url)
          .catch(() => null)
      );

    const newConnections = (await Promise.allSettled(connectingPromises))
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    activeRelays = new Set([
      ...workingConnections,
      ...newConnections.filter(Boolean),
    ]);

    if (!activeRelays.size) {
      for (const url of primaryRelays) {
        try {
          await createWebSocket(url);
          activeRelays = new Set([url]);
          break;
        } catch (err) {
          console.error(`Failed to connect to primary relay ${url}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Error during relay update:", err);
  }
};

updateRelays().catch(console.error);

// Periodic relay maintenance (every 40 seconds)
let isUpdating = false;
setInterval(async () => {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const workingConnections = [...wsConnections.entries()]
      .filter(([, ws]) => ws.readyState === WebSocket.OPEN)
      .map(([url]) => url);
    if (!workingConnections.length) await updateRelays();
    activeRelays = new Set(workingConnections);
  } catch (err) {
    console.error("Connection maintenance error:", err);
  }
  isUpdating = false;
}, 40000);

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
