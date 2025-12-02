import { updateProfile } from "./update-profile.js";
import { generateUId, getFromLocalStorage } from "./utils.js";
import { attachRelatedKind } from "./attach-related.js";
import { displayComment } from "./display-comments.js";
import { displayReaction } from "./display-reactions.js";

// Global caches
window.proposalsCache = window.proposalsCache || new Map(); // Cache proposals by UID
window.proposalUids = window.proposalUids || new Set(); // Track proposal UIDs for fetching related events
window.profileCache = window.profileCache || new Map(); // Cache profiles by pubkey

// Add pubkey to cache to trigger profile fetching
const addPubkeyToCache = (pubkey) => {
  if (pubkey && !window.profileCache.has(pubkey)) {
    profileCache.set(pubkey, {}); // Initialize empty profile
  }
};

// Handle proposal events (kind 30023 = published, 30024 = draft)
export const handleProposal = (data, onEvent) => {
  // Only process proposal kinds
  if (data.kind !== 30023 && data.kind !== 30024) return;

  // Generate unique ID from pubkey + d-tag
  const uid = generateUId(data);
  if (!uid) return;

  // Skip if we have a newer version cached
  const cached = window.proposalsCache.get(uid);
  if (cached && cached.created_at >= data.created_at) return;

  // Cache proposal and add author to profile cache
  addPubkeyToCache(data.pubkey);
  proposalsCache.set(uid, data);
  proposalUids.add(uid); // Track for fetching related events
  onEvent?.(data, uid); // Call callback with proposal data
};

// Handle profile events (kind 0)
export const handleProfile = (data) => {
  if (data.kind !== 0) return; // Only process profile events

  const { pubkey, created_at } = data;
  const cached = window.profileCache.get(pubkey);

  // Update if newer than cached version
  if (!cached || (cached.created_at || 0) < created_at) {
    profileCache.set(pubkey, data); // Cache profile
    updateProfile(pubkey); // Update UI with profile data

    // Update localStorage if this is the logged-in user
    const userInfo = getFromLocalStorage("userInfo");
    if (
      userInfo?.pubkey === pubkey &&
      (userInfo.created_at || 0) < created_at
    ) {
      const profileData = JSON.parse(data.content);
      localStorage.setItem(
        "userInfo",
        JSON.stringify({ ...userInfo, ...profileData, created_at }),
      );
    }
  }
};

// Handle related events (kind 7 = reactions, 1111 = comments)
export const handleRelated = (data, onEvent) => {
  // Only process reactions and comments
  if (data.kind !== 7 && data.kind !== 1111) return;

  attachRelatedKind(data); // Update proposal card counts in browse/profile pages
  onEvent?.(data); // Call callback with related data
};

// Process and display related data (for proposal preview page only)
export const processRelated = (relatedData, container) => {
  // Cache reaction or comment
  const cache =
    relatedData.kind === 7 ? relatedCache.reactions : relatedCache.comments;
  cache.set(relatedData.id, relatedData);

  // Display in appropriate container
  if (relatedData.kind === 7) displayReaction(relatedData, container.reactions);
  if (relatedData.kind === 1111)
    displayComment(relatedData, container.comments);
};

// Note: These functions are independent handlers called from different files (browse.js, proposal.js, etc.)
