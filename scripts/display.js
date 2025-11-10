import { getTag, generateUId } from "./utils.js";
import { fetchProposals, fetchRelated, fetchProfile } from "./nostr-fetch.js";
import { attachRelatedKind } from "./attach-related.js";
import { updateProfile } from "./update-profile.js";
import { displayProposal } from "./proposal-card.js";

// Initialize global state
const initState = () => {
  window.isFetching = false;
  window.isPendingFetchkind0 = false;
  window.isPendingFetchRelatedkind = false;
  window.proposalsCache = new Map();
  window.profileCache = new Map();
  window.reactionsCache = window.reactionsCache || {};
  window.relatedKindsUIds = new Set();
  window.proposalSubId = null;
  window.relatedSubId = null;
  window.profileSubId = null;
};

export const displayProposals = (options = {}) => {
  const {
    container = document.getElementById("fetched-proposals"),
    statusEl = document.getElementById("fetched-text"),
    filters = { limit: 20 }
  } = options;

  let oldestTime = null;
  let newCount = 0;

  initState();

  const getProfile = (pubkey = null) => fetchProfile(pubkey, handleEvent, updateProfile);
  const getRelatedKinds = (uid = null) => fetchRelated(uid, handleEvent);

  const handleEvent = ([type, subId, data]) => {
    if (type === "EOSE") {
      const pendingSubId = window.proposalSubId || window.profileSubId || window.relatedSubId;
      if (subId === pendingSubId) {
        if (window.isPendingFetchkind0) {
          window.isPendingFetchkind0 = false;
          return getProfile();
        }
        if (window.isPendingFetchRelatedkind) {
          window.isPendingFetchRelatedkind = false;
          return getRelatedKinds();
        }
        window.isFetching = false;
      }
    }
    
    if (type === "EVENT") {
      const { kind, pubkey, created_at, tags } = data;
      
      if (kind === 30023 || kind === 30024) {
        const dTag = getTag(tags, "d") || "";
        if (dTag.startsWith("opencollective-proposal:")) processItem(data);
      }

      if (kind === 7 || kind === 1111) attachRelatedKind(data);

      if (kind === 0) {
        const cached = window.profileCache.get(pubkey);
        if (!cached || (cached.created_at || 0) < created_at) {
          window.profileCache.set(pubkey, data);
          updateProfile(pubkey);
        }
      }
    }
  };

  const processItem = (event) => {
    const { pubkey, created_at } = event,
      uid = generateUId(event);
    if (!uid) return;
    
    const cached = window.proposalsCache.get(uid);
    if (cached && cached.created_at >= created_at) return;
    
    newCount++;
    window.proposalsCache.set(uid, event);
    if (!oldestTime || created_at < oldestTime) oldestTime = created_at;
    
    render();
    getProfile(pubkey);
    getRelatedKinds(uid);
    setTimeout(checkComplete, 5000);
  };

  const render = () => {
    [...window.proposalsCache.values()]
      .sort((a, b) => b.created_at - a.created_at)
      .forEach((event) => displayProposal(event, container));
  };

  const checkComplete = () => {
    if (newCount === 0) {
      if (statusEl) statusEl.innerHTML = "All proposals loaded";
      container?.querySelector(".loader")?.classList.add("hidden");
    } else if (newCount < 10) load();
  };

  const load = () => {
    if (window.isFetching) return;
    window.isFetching = true;
    newCount = 0;
    
    const query = { ...filters };
    if (oldestTime) query.until = oldestTime;
    
    fetchProposals(null, handleEvent, query);
  };

  return { load };
};