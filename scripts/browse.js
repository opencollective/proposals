
import * as NostrTools from "./nostr-tools.bundle.mjs";
import { displayProposal } from "./proposal-card.js";
import { handleProposal, handleRelated } from "./event-handlers.js";
import { fetchProposals, fetchProfiles, fetchRelated } from "./nostr-fetch.js";
import {
  generateUId,
  getFromLocalStorage,
  setupScrollObserver,
} from "./utils.js";

// Global caches
window.proposalsCache = window.proposalsCache || new Map(); // Cache proposals by UID
window.proposalUids = window.proposalUids || new Set(); // Track proposal UIDs for fetching related events
window.reactionsCache = window.reactionsCache || {}; // Cache reactions by proposal UID

export const browse = (options = {}) => {
  const id = document.getElementById.bind(document),
    {
      container = id("fetched-proposals"), // Container for proposal cards
      statusEl = id("fetched-text"), // Status message element
      filters = {}, // Additional filters for proposals
    } = options,
    pathname = window.location.pathname.slice(1),
    isNpubUrl = pathname.startsWith("npub"), // Check if viewing user profile
    group = getFromLocalStorage("group"),
    groupUid = group ? generateUId(group) : null; // Filter by group if selected

  // Pagination state
  let oldestTime = null, // Timestamp of oldest proposal for pagination
    newCount = 0; // Count of new proposals loaded in current batch

  // Add npub pubkey to profileCache for profile page
  if (isNpubUrl) {
    const { data: pubkey } = NostrTools.nip19.decode(pathname);
    if (pubkey && !profileCache.has(pubkey)) {
      profileCache.set(pubkey, {}); // Initialize empty profile
    }
  }

  // Load proposals from relays with pagination
  const loadProposals = () => {
    newCount = 0; // Reset counter for new batch

    // Build query with pagination and group filter
    const query = { ...filters };
    if (oldestTime) query.until = oldestTime; // Pagination
    if (groupUid) query["#A"] = [groupUid]; // Filter by group

    fetchProposals(
      query,
      (data) => {
        handleProposal(data, (proposal) => {
          newCount++;
          if (!oldestTime || proposal.created_at < oldestTime)
            oldestTime = proposal.created_at;
          displayProposal(proposal, container);
        });
      },
      () => {
        checkComplete();

        // Fetch profiles and reactions after proposals loaded
        fetchProfiles(undefined, undefined, () => {
          fetchRelated([...window.proposalUids], handleRelated);
        });
      },
    );
  };

  // Check if loading is complete and setup pagination if needed
  const checkComplete = () => {
    const userInfo = getFromLocalStorage("userInfo") || {};

    if (newCount === 0) {
      // No new proposals loaded - show completion message
      container?.querySelector(".loader")?.classList.add("hidden");
      if (statusEl) {
        statusEl.innerHTML =
          proposalsCache.size === 0
            ? `<div class="proposal-card-no-data">
              <div class="markdown">
                <h2>No proposals found</h2>
                <p>
                  There are no proposals
                  ${
                    isNpubUrl
                      ? "matching the current profile"
                      : "available at the moment"
                  }
                </p>
              </div>
              ${
                isNpubUrl && pathname !== userInfo?.npub
                  ? ""
                  : `<a href="/create">
                    <button class="btn btn-primary">Create proposal</button>
                  </a>`
              }
            </div>`
            : "All proposals loaded";
      }
    } else if (newCount < 10) {
      // Less than 10 proposals - load more immediately
      loadProposals();
    } else {
      // 10+ proposals - setup infinite scroll for pagination
      setupScrollObserver(container, ".proposal-card", loadProposals);
    }
  };

  const load = () => loadProposals();

  return { load };
};

// Flow: loadProposals → fetchProposals → handleProposal (cache & render) → checkComplete (status/pagination) → fetchProfiles → fetchRelated (reactions/comments)
