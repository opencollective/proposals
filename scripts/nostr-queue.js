import sendMessage from "./send-message.js";
import { fetchProfiles } from "./nostr-fetch.js";

// Shared profile cache
window.profileCache = window.profileCache || new Map();

// Queue state
const queue = []; // Queue of pending fetch requests
let processing = false; // Is queue currently processing?
let pendingProfileFetch = false; // Need to fetch profiles after current batch?

// Fetch events from relays
const fetch = (subId, filters, onEvent, onComplete) => {
  let eoseCount = 0; // Count EOSE messages received
  const totalRelays = activeRelays.size; // Total number of active relays

  // Send REQ message to all relays
  sendMessage(JSON.stringify(["REQ", subId, filters]), ([type, sid, data]) => {
    if (type === "EVENT") {
      onEvent?.(data); // Handle event
      // Add new pubkey to cache for profile fetching
      if (data.pubkey && !window.profileCache.has(data.pubkey)) {
        window.profileCache.set(data.pubkey, {}); // Initialize empty profile
        pendingProfileFetch = true; // Mark for profile fetch
      }
    }
    // Wait for all relays to send EOSE (End Of Stored Events)
    if (type === "EOSE" && sid === subId && ++eoseCount >= totalRelays) {
      onComplete?.(); // All relays finished
    }
  });
};

// Fetch profiles for all pubkeys in cache
const processProfiles = () => {
  if (!pendingProfileFetch) return; // No new profiles to fetch
  pendingProfileFetch = false; // Reset flag

  fetchProfiles(); // Fetch all profiles in cache
};

// Process next item in queue
const next = () => {
  // Queue empty or busy? Fetch profiles if needed
  if (processing || !queue.length) {
    if (!processing) processProfiles(); // Fetch profiles when queue is empty
    return;
  }
  // Process next item in queue
  processing = true;
  const { id, filters, onEvent, onComplete } = queue.shift(); // Get next item
  fetch(id, filters, onEvent, () => {
    processing = false; // Mark as done
    onComplete?.(); // Call completion callback
    next(); // Process next item
  });
};

// Add fetch request to queue
export const addToQueue = (subId, filters, onEvent, onComplete) => {
  queue.push({ id: subId, filters, onEvent, onComplete }); // Add to queue
  next(); // Start processing if not already
};

// Flow: addToQueue → next (process queue) → fetch (send REQ to relays) → handle EVENT/EOSE → onComplete → next (process next) → processProfiles (when queue empty)
