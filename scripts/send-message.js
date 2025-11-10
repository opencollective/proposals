// Send message to all relays
const sendMessage = async (message, handleFunction) => {
  for (const relayUrl of activeRelays) {
    try {
      const ws =
        wsConnections.get(relayUrl) || (await createWebSocket(relayUrl));

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        ws.onmessage = (e) => handleFunction(JSON.parse(e.data), relayUrl); // Handle response
      }
    } catch (err) {
      console.warn(`Skipping ${relayUrl}:`, err);
      activeRelays.delete(relayUrl);

      if (activeRelays.size === 0) {
        return alert("❌ All relays failed");
      }
    }
  }
};

export default sendMessage;
