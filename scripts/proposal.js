import * as NostrTools from "./nostr-tools.bundle.mjs";
import { renderProposalPreview } from "./proposal-preview.js";
import { setupInteractions } from "./proposal-interactions.js";
import { getFromLocalStorage, getTag, generateUId } from "./utils.js";
import {
  fetchGroups,
  fetchRelated,
  fetchProfiles,
  fetchProposals,
} from "./nostr-fetch.js";
import {
  handleRelated,
  processRelated,
  handleProposal,
} from "./event-handlers.js";

// DOM helpers and extract event ID from URL
const id = document.getElementById.bind(document),
  query = document.querySelector.bind(document),
  pathname = window.location.pathname.slice(1),
  eventId = pathname.split("?")[0]; // nevent/naddr/hex ID

// Current proposal state
let proposal = null;

// Global caches
window.proposalsCache = window.proposalsCache || new Map(); // Cache proposals by UID
window.profileCache = window.profileCache || new Map(); // Cache profiles by pubkey
window.relatedCache = window.relatedCache || {
  reactions: new Map(), // Cache reactions by proposal UID
  comments: new Map(), // Cache comments by proposal UID
};

// Show comment input if user is logged in
const setupCommentInput = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (!userInfo) return; // Not logged in

  // Toggle visibility: hide sign-in prompt, show comment sunbmit/sign button
  [query(".sign-btn"), query("#btn-submit-comment")].forEach(
    (el) => el?.classList.toggle("hidden"),
  );

  // Set user pubkey and profile picture
  const container = query(".comment-inputs-container"),
    img = container?.querySelector("img");
  if (container) container.setAttribute("data-pubkey", userInfo.pubkey);
  if (img && userInfo.picture) img.src = userInfo.picture;
  
  // Restore draft comment
  const draft = sessionStorage.getItem("commentDraft") || localStorage.getItem("commentDraft");
  if (draft) {
    const input = id("comment-input");
    if (input) input.value = draft;
  }
};

// Submit pending comment after metadata check completes
window.submitPendingComment = () => {
  const draft = sessionStorage.getItem("commentDraft") || localStorage.getItem("commentDraft");
  if (!draft) return;
  
  const userInfo = getFromLocalStorage("userInfo");
  if (!userInfo) return;
  
  const hasName = !!(userInfo.displayName || userInfo.display_name || userInfo.name);
  if (hasName || userInfo.anonymous) {
    setTimeout(() => {
      id("btn-submit-comment")?.click();
      // Clear input field after submission
      setTimeout(() => {
        const input = id("comment-input");
        if (input) input.value = "";
      }, 100);
    }, 100);
  }
};

// Clear comment draft after successful submission
window.clearCommentDraft = () => {
  sessionStorage.removeItem("commentDraft");
  localStorage.removeItem("commentDraft");
};

// Show edit/delete buttons if user owns the proposal
const setupActionButtons = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (!proposal || !userInfo || userInfo.pubkey !== proposal.pubkey) return; // Not owner
  if (query(".update-buttons-container")) return; // Already added

  const targetContainer = query("#proposal-actions-container");
  if (!targetContainer) return;

  targetContainer.insertAdjacentHTML(
    "beforeend",
    `
    <div class="flex gap-sm update-buttons-container">
      <button class="button" id="edit-button" title="Edit Proposal">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#656666" d="M23.44 5.93 18.06.56a1.9 1.9 0 0 0-2.7 0L.57 15.36c-.37.35-.57.84-.57 1.35v5.37C0 23.14.86 24 1.92 24H7.3c.51 0 1-.2 1.35-.57L23.44 8.65c.75-.75.75-1.96 0-2.71M7.28 22.08H1.92v-5.37L12.49 6.16l5.36 5.37zM19.2 10.17 13.82 4.8l2.89-2.87 5.38 5.37z"/>
        </svg>
      </button>
      <button class="button" id="delete-button" title="Delete Proposal">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 24">
          <path fill="#656666" d="M11 0C9 0 7.3 1.6 7.3 3.6H.9c-.5 0-.9.4-.9.9s.4.9.9.9h1.5v15.3c0 1.8 1.5 3.3 3.4 3.3h10.4c1.8 0 3.4-1.5 3.4-3.3V5.4h1.5c.5 0 .9-.4.9-.9s-.4-.9-.9-.9h-6.4C14.7 1.6 13 0 11 0m0 1.8c1 0 1.8.8 1.8 1.8H9.1c0-1 .8-1.8 1.8-1.8M4.3 5.4h13.4v15.3c0 .8-.7 1.5-1.5 1.5H5.8c-.9 0-1.5-.7-1.5-1.5zm4.5 3c-.5 0-.9.4-.9.9v9c0 .5.4.9.9.9s.9-.4.9-.9v-9c0-.5-.4-.9-.9-.9m4.3 0c-.5 0-.9.4-.9.9v9c0 .5.4.9.9.9s.9-.4.9-.9v-9c0-.5-.4-.9-.9-.9"/>
        </svg>
      </button>
    </div>
  `,
  );

  // Edit button: save proposal to localStorage and navigate to create page
  query("#edit-button")?.addEventListener("click", () => {
    localStorage.setItem("editProposal", JSON.stringify(proposal));
    window.location.href = "/create";
  });
};

// Setup UI elements based on user login state
const setupUserUI = () => {
  setupCommentInput(); // Show comment input if logged in
  setupActionButtons(); // Show edit/delete buttons if owner
};

// Decode event ID (nevent/naddr/hex) to relay filters
const decodeEventId = () => {
  // Decode nevent or naddr to get event details
  const decoded =
      pathname.startsWith("nevent") || pathname.startsWith("naddr")
        ? NostrTools.nip19.decode(eventId)?.data
        : null,
    // Build filters based on ID type
    filters = decoded
      ? pathname.startsWith("naddr")
        ? { authors: [decoded.pubkey], "#d": [decoded.identifier] } // Addressable event
        : { ids: [decoded.id] } // Regular event
      : /^[a-f0-9]{64}$/i.test(eventId)
        ? { ids: [eventId] } // Hex ID
        : null;

  if (!filters) throw new Error("Invalid ID");
  if (decoded?.kind) filters.kinds = [decoded.kind]; // Add kind if available
  return filters;
};

// Fetch group metadata if proposal has A tag (group reference)
const fetchGroup = (aTag) => {
  if (!aTag) return; // No group

  // Parse A tag: kind:author:d-tag
  const [kind, author, d] = aTag.split(":");
  if (kind === "34550" && author && d) {
    // Fetch group event (kind 34550)
    fetchGroups({ authors: [author], "#d": [d], limit: 1 }, (groupData) => {
      if (groupData.kind === 34550) {
        // Extract group name and image
        const name =
            getTag(groupData.tags, "name") ||
            getTag(groupData.tags, "d") ||
            "Group",
          image = getTag(groupData.tags, "image");

        // Dispatch event to update UI with group info
        window.dispatchEvent(
          new CustomEvent("groupReceived", { detail: { name, image } }),
        );
      }
    });
  }
};

// Load proposal and related data in sequence
const loadProposal = () => {
  if (!eventId) return history.back(); // No event ID in URL

  try {
    const filters = decodeEventId(); // Decode ID to filters

    // Step 1: Fetch proposal event
    fetchProposals(
      filters,
      (data) => {
        handleProposal(data, (proposalData) => {
          proposal = proposalData;
          renderProposalPreview(proposal, id("proposal-preview")); // Render proposal
          setupUserUI(); // Setup comment input and action buttons
          setupInteractions(proposal, getFromLocalStorage("userInfo")); // Setup interactions (comment, react, delete)
          fetchGroup(getTag(proposalData.tags, "A")); // Fetch group if exists
        });
      },
      () => {
        // Redirect to 404 if proposal not found
        if (!proposal)
          return setTimeout(() => (window.location.href = "/404"), 1000);

        // Step 2: Fetch profile for proposal author
        fetchProfiles(undefined, undefined, () => {
          const uid = generateUId(proposal),
            containers = {
              reactions: query(".reactions-container"),
              comments: query(".comments-container"),
            };

          // Step 3: Fetch reactions and comments
          fetchRelated(
            [uid],
            (data) => {
              handleRelated(
                data,
                (relatedData) => processRelated(relatedData, containers), // Display reactions/comments
              );
            },
            () => {
              // Step 4: Fetch profiles for commenters and reactors
              fetchProfiles();
            },
          );
        });
      },
    );
  } catch {
    alert("Invalid event ID");
    history.back();
  }
};

// Listen for login/logout events to update UI
window.addEventListener("userInfoUpdated", setupUserUI);

// Listen for metadata check completion to submit pending comment
window.addEventListener("metadataCheckComplete", () => {
  window.submitPendingComment?.();
});

// Check for pending comment on page load (after redirect from user-metadata)
const userInfo = getFromLocalStorage("userInfo");
if (userInfo) {
  setupUserUI();
  const draft = sessionStorage.getItem("commentDraft") || localStorage.getItem("commentDraft");
  if (draft) {
    setTimeout(() => window.submitPendingComment?.(), 2000);
  }
}

// Setup sign button click handler
query(".sign-btn")?.addEventListener("click", () => {
  const input = id("comment-input");
  if (input?.value) {
    sessionStorage.setItem("commentDraft", input.value);
    localStorage.setItem("commentDraft", input.value);
  }
  id("btn-login")?.click();
});

// Start loading proposal on page load
loadProposal();

// Flow: loadProposal (decode ID) → fetchProposals → handleProposal (cache & render) → setupUserUI & setupInteractions & fetchGroup → fetchProfiles (author) → fetchRelated (reactions/comments) → handleRelated & processRelated (display) → fetchProfiles (commenters/reactors)
