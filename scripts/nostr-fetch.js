import sendMessage from "./send-message.js";
import { addToQueue } from "./nostr-queue.js";
import { handleProfile } from "./event-handlers.js";
import { updateProfile } from "./update-profile.js";

// Subscription IDs for managing active relay subscriptions
const subIds = {};

// Shared profile cache across all files
window.profileCache = window.profileCache || new Map();

// Close existing subscription and create new one
const sub = (key, prefix, filters, onEvent, onComplete) => {
  if (subIds[key])
    sendMessage(JSON.stringify(["CLOSE", subIds[key]]), () => {}); // Close old subscription
  subIds[key] = `${prefix}-${Date.now()}`; // Generate new subscription ID
  addToQueue(subIds[key], filters, onEvent, onComplete); // Add to queue
};

// Fetch proposals (kind 30023 = published) with proposal tag
export const fetchProposals = (filters, onEvent, onComplete) => {
  if (!subIds.proposal) subIds.proposal = `proposals-${Date.now()}`; // Create subscription ID once
  addToQueue(
    subIds.proposal,
    { "#t": ["proposal"], kinds: [30023], limit: 20, ...filters }, // Default: 20 proposals with 't' tag
    onEvent,
    onComplete,
  );
};

// Fetch reactions (kind 7) and comments (kind 1111) for proposals
export const fetchRelated = (uids, onEvent, onComplete) => {
  sub(
    "related",
    "related",
    { kinds: [7, 1111], "#a": [...uids] }, // Filter by proposal UIDs
    onEvent,
    onComplete,
  );
};

// Fetch groups (kind 34550)
export const fetchGroups = (filters, onEvent, onComplete) => {
  if (!subIds.groups) subIds.groups = `groups-${Date.now()}`; // Create subscription ID once
  addToQueue(
    subIds.groups,
    { kinds: [34550], limit: 100, ...filters }, // Default: 100 groups
    onEvent,
    onComplete,
  );
};

// Generic fetch with custom filters
export const fetch = (id, filters, onEvent, onComplete) => {
  addToQueue(`${id}-${Date.now()}`, filters, onEvent, onComplete); // Generate unique subscription ID
};

// Fetch profiles (kind 0) - updates cached profiles first, then fetches missing ones
export const fetchProfiles = (
  pubkeys = [...profileCache.keys()], // Default: all pubkeys in cache
  onEvent = handleProfile, // Default: handleProfile from event-handlers.js
  onComplete,
) => {
  if (!pubkeys.length) return; // No pubkeys to fetch

  // Update UI for cached profiles with content, filter out ones that need fetching
  const toFetch = pubkeys.filter((pk) => {
    const cached = profileCache.get(pk);
    if (cached?.content) {
      updateProfile(pk); // Update UI immediately with cached data
      return false; // Don't fetch
    }
    return true; // Fetch from relays
  });

  if (!toFetch.length) return onComplete?.(); // All profiles cached
  sub(
    "profile",
    "profile",
    { kinds: [0], authors: toFetch }, // Fetch missing profiles
    onEvent,
    onComplete,
  );
};

// Flow: sub (close old & create new subscription) → addToQueue → sendMessage → relay responses → onEvent callbacks → onComplete
