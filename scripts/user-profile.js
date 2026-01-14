import { fetchProfiles } from "./nostr-fetch.js";
import { getFromLocalStorage } from "./utils.js";

window.profileCache = window.profileCache || new Map();

// Ensure user profile is fetched and up-to-date
// Use this ONLY on pages that don't already call fetchProfiles (like create page)
// Pages like browse.js already fetch all profiles automatically
export const ensureUserProfile = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (!userInfo?.pubkey) return;
  
  // Add to cache and fetch immediately
  if (!window.profileCache.has(userInfo.pubkey)) {
    window.profileCache.set(userInfo.pubkey, {});
  }
  
  // Fetch only user's profile
  fetchProfiles([userInfo.pubkey]);
};
