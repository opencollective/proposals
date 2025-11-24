import sendMessage from "./send-message.js";

// Global subscription IDs and state flags
window.proposalSubId = null;
window.profileSubId = null;
window.relatedSubId = null;
window.groupsSubId = null;
window.isFetching = false;
window.isPendingFetchkind0 = false;
window.isPendingFetchRelatedkind = false;

// Core subscription helper - manages Nostr relay subscriptions
const sub = (id, prefix, filters, handleEvent) => {
  if (window[id]) sendMessage(JSON.stringify(["CLOSE", window[id]])); // Close existing subscription
  window[id] = `${prefix}-${Date.now()}`; // Generate unique ID
  sendMessage(JSON.stringify(["REQ", window[id], filters]), handleEvent);
};

// Fetch proposal events (kind 30023/30024) with pagination
export const fetchProposals = (oldestTime, handleEvent, customFilters) => {
  const filters = { "#t": ["proposal"], ...customFilters };
   // Add kinds if not already defined
  if (!customFilters.kinds) {
    filters.kinds = [30023];
  }
  if (oldestTime) filters.until = oldestTime; // Add pagination filter
  sub('proposalSubId', 'ocp', filters, handleEvent);
};

// Fetch reactions (kind 7) and comments (kind 1111)
export const fetchRelatedKinds = (relatedKindsUIds, handleEvent) => {
  const filters = { kinds: [7, 1111], "#a": [...relatedKindsUIds] };
  sub('relatedSubId', 'ocp-r', filters, handleEvent);
};

// Fetch user profiles (kind 0)
export const fetchKind0 = (pubkeys, handleEvent) => {
  const filters = { kinds: [0], authors: [...pubkeys] };
  sub('profileSubId', 'ocp-p', filters, handleEvent);
};

// Smart profile fetcher with caching
export const fetchProfile = (pubkey = null, handleEvent, updateProfile) => {
  if (pubkey) {
    const cachedProfile = window.profileCache.get(pubkey);
    if (cachedProfile && Object.keys(cachedProfile).length > 0) {
      if (updateProfile) updateProfile(pubkey); // Use cached profile
      return;
    }
    window.profileCache.set(pubkey, {}); // Initialize cache
    if (window.isFetching) {
      window.isPendingFetchkind0 = true; // Set pending flag
      return;
    }
  }
  fetchKind0([...window.profileCache.keys()], handleEvent); // Fetch all cached pubkeys
};

// Smart related kinds fetcher with deduplication
export const fetchRelated = (uid, handleEvent) => {
  if (uid) {
    if (window.relatedKindsUIds.has(uid)) return; // Skip if already tracked
    window.relatedKindsUIds.add(uid); // Add to tracking set
    if (window.isFetching) {
      window.isPendingFetchRelatedkind = true; // Set pending flag
      return;
    }
    return;
  }
  fetchRelatedKinds(window.relatedKindsUIds, handleEvent); // Fetch all tracked UIDs
};

// Fetch groups (kind 34550) with pagination
export const fetchGroups = (oldestTime, handleEvent, customFilters = {}) => {
  const filters = { kinds: [34550], ...customFilters };
  if (oldestTime) filters.until = oldestTime;
  sub('groupsSubId', 'ocp-g', filters, handleEvent);
};