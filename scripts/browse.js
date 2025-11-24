import { getTag, generateUId, getFromLocalStorage, setupScrollObserver } from "./utils.js";
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

export const browse = (options = {}) => {
  const id = document.getElementById.bind(document),
    {
      container = id("fetched-proposals"),
      statusEl = id("fetched-text"),
      filters = { limit: 20 },
      fetchProfileFirst = null
    } = options,
    pathname = window.location.pathname.slice(1),
    isNpubUrl = pathname.startsWith("npub"),
    group = getFromLocalStorage('group'),
    groupUid = group ? generateUId(group) : null;

  let oldestTime = null;
  let newCount = 0;
  let profileFetched = !fetchProfileFirst;

  initState();

  const getProfile = (pubkey = null) => fetchProfile(pubkey, handleEvent, updateProfile),
    getRelatedKinds = (uid = null) => fetchRelated(uid, handleEvent);

  const handleEvent = ([type, subId, data]) => {
    if (type === "EOSE") {
      if (fetchProfileFirst && !profileFetched && subId === window.profileSubId) {
        profileFetched = true;
        return loadProposals();
      }
      
      const pendingSubId = window.proposalSubId || window.relatedSubId;
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
        checkComplete();
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
    setupScrollObserver(container, '.proposal-card', loadProposals);
  };

  const checkComplete = () => {
    const userInfo = getFromLocalStorage("userInfo") || {};

    if (newCount === 0) {
      container?.querySelector(".loader")?.classList.add("hidden");
      if (statusEl) {
        statusEl.innerHTML = 
          proposalsCache.size === 0 
          ? `<div class="proposal-card-no-data">
              <div class="markdown">
                <h2>No proposals found</h2>
                <p>
                  There are no proposals
                  ${ isNpubUrl 
                    ? "matching the current profile" 
                    : "available at the moment" 
                  }
                </p>
              </div>
              ${ isNpubUrl && pathname !== userInfo?.npub
                ? ""
                : `<a href="/create">
                    <button class="btn btn-primary">Create proposal</button>
                  </a>`
                
              }
            </div>`
          : "All proposals loaded";
      }
    } else if (newCount < 10) {
      loadProposals();
    } else {
      setupScrollObserver(container, '.proposal-card', loadProposals);
    }
  };

  const loadProposals = () => {
    if (window.isFetching) return;
    window.isFetching = true;
    newCount = 0;
    
    const query = { ...filters };
    if (oldestTime) query.until = oldestTime;
    if (groupUid) query['#A'] = [groupUid];
    
    fetchProposals(null, handleEvent, query);
  };

  const load = () => {
    if (fetchProfileFirst && !profileFetched) {
      getProfile(fetchProfileFirst);
    } else {
      loadProposals();
    }
  };

  return { load };
};
