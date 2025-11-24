import * as NostrTools from "./nostr-tools.bundle.mjs";
import { fetchProposals, fetchProfile, fetchRelated, fetchGroups } from "./nostr-fetch.js";
import { updateProfile } from "./update-profile.js";
import { getFromLocalStorage, getTag, generateUId, setButtonLoading } from "./utils.js";
import { attachRelatedKind } from "./attach-related.js";
import { displayComment } from "./display-comments.js";
import { displayReaction } from "./display-reactions.js";
import { renderProposalPreview } from "./proposal-preview.js";
import { createReaction, createComment, deleteEvent } from "./nostr-create.js";
import { handleOK } from "./handle-ok.js";
import { showReactionPicker, getReactionContent } from "./reaction-picker.js";

// Extract event ID from URL
const id = document.getElementById.bind(document),
  query = document.querySelector.bind(document),
  pathname = window.location.pathname.slice(1),
  eventId = pathname.split("?")[0];

// State management
let proposal = null;
const userInfo = getFromLocalStorage("userInfo");

// Global state
window.isFetching = false;
window.isPendingFetchkind0 = false;
window.isPendingFetchRelatedkind = false;
window.proposalsCache = new Map();
window.profileCache = new Map();
window.relatedCache = { reactions: new Map(), comments: new Map() };
window.relatedKindsUIds = new Set();
window.proposalSubId = null;
window.relatedSubId = null;
window.profileSubId = null;

// Wrapper function for profile fetching
const getProfile = (pubkey = null) => fetchProfile(pubkey, handleEvent, updateProfile),
  getRelatedKinds = (uid = null) => fetchRelated(uid, handleEvent);

// Main event handler
const handleEvent = ([type, subId, data]) => {
  if (type === "OK") {
    return handleOK([type, subId, data]);
  }
  
  if (type === "EOSE") {
    const pendingSubId = proposalSubId || profileSubId || relatedSubId;
    if (subId === pendingSubId) {
      if (isPendingFetchkind0) {
        isPendingFetchkind0 = false;
        return getProfile();
      }
      if (isPendingFetchRelatedkind) {
        isPendingFetchRelatedkind = false;
        return getRelatedKinds();
      }
      isFetching = false;
    }
  }
  
  if (type === "EVENT") {
    const { kind, pubkey, created_at, tags } = data;

    if (kind === 30023 || kind === 30024) {
      const dTag = getTag(tags, "d");
      if (dTag?.startsWith("opencollective-proposal:") && (!proposal || created_at > proposal.created_at)) {
        proposal = data;
        renderProposalPreview(proposal, id("proposal-preview"));
        getProfile(pubkey);
        getRelatedKinds(generateUId(proposal));
        
        // Fetch group from A tag
        const aTag = getTag(tags, "A");
        if (aTag) {
          const [kind, author, d] = aTag.split(':');
          if (kind === '34550' && author && d) {
            fetchGroups(null, handleEvent, { authors: [author], '#d': [d], limit: 1 });
          }
        }
      }
    }
    
    if (kind === 34550) {
      const name = getTag(tags, 'name') || getTag(tags, 'd') || 'Group',
        image = getTag(tags, 'image') || '/images/people.svg';
      
      window.dispatchEvent(new CustomEvent('groupReceived', { detail: { name, image } }));
    }

    if (kind === 0) {
      const cached = profileCache.get(pubkey);
      if (!cached || (cached.created_at || 0) < created_at) {
        profileCache.set(pubkey, data);
        updateProfile(pubkey);
      }
    }

    if (kind === 7 || kind === 1111) {
      const cache = kind === 7 ? relatedCache.reactions : relatedCache.comments;
      cache.set(data.id, data);
      attachRelatedKind(data);
      if (kind === 7) displayReaction(data, query(".reactions-container"));
      if (kind === 1111) displayComment(data, query(".comments-container"));
      getProfile(pubkey);
    }
  }
};

// Fetch proposal data
const loadProposal = () => {
  if (!eventId) return history.back();
  
  if(userInfo) {
    const container = query(".comment-inputs-container");

    [
      query(".comment-sign-container"),
      query(".comment-input-container")
    ].forEach(el => el.classList.toggle("hidden"));

    const img = container?.querySelector("img");
    if (container) container.setAttribute("data-pubkey", userInfo.pubkey);
    if (img && userInfo.picture) img.src = userInfo.picture;
  }

  try {
    const decoded = pathname.startsWith("nevent" || "naddr")
      ? NostrTools.nip19.decode(eventId)?.data
      : null;

    const filters = decoded
      ? pathname.startsWith("naddr")
        ? { authors: [decoded.pubkey], "#d": [decoded.identifier] }
        : { ids: [decoded.id] }
      : /^[a-f0-9]{64}$/i.test(eventId)
        ? { ids: [eventId] }
        : null;

    if (!filters) throw new Error("Invalid ID");
    // Add kinds if decoded has a kind
    if (decoded?.kind) {
      filters.kinds = [decoded.kind];
    }
    isFetching = true;
    fetchProposals(null, handleEvent, filters);
    
    // Redirect to 404 if proposal not found after 5 seconds
    setTimeout(() => {
      if (!proposal) window.location.href = '/404';
    }, 5000);
  } catch {
    alert("Invalid event ID");
    history.back();
  }
};

// Comment submission
query("#btn-submit-comment")?.addEventListener('click', () => {
  const btn = query("#btn-submit-comment"),
    content = query("#comment-input")?.value?.trim();
  if (!content) return;
  setButtonLoading(btn, true);
  createComment(
    proposal,
    content,
    handleEvent,
    () => {
      query("#comment-input").value = '';
      setButtonLoading(btn, false);
    },
    () => setButtonLoading(btn, false)
  );
});

const handleDelete = (event, cache, selector, btn) => {
  if (btn) setButtonLoading(btn, true);
  deleteEvent(
    event,
    handleEvent,
    () => {
      cache.delete(event.id);
      document.querySelector(selector)?.remove();
      attachRelatedKind(event, true);
    },
    () => btn && setButtonLoading(btn, false)
  );
};

// Event delegation
document.addEventListener('click', (e) => {
  if (e.target.closest('.reaction-item.reactions .icon')) {
    e.stopPropagation();
    if (!userInfo) return;
    
    const icon = e.target.closest('.reaction-item.reactions .icon');
    const existing = Array.from(relatedCache.reactions.values())
      .find(r => r.pubkey === userInfo.pubkey);
    
    if (existing) {
      handleDelete(existing, relatedCache.reactions, `[data-reaction-id="${existing.id}"]`);
    } else {
      showReactionPicker(icon, (key) => {
        createReaction(proposal, getReactionContent(key), handleEvent);
      });
    }
  }
  
  if (e.target.closest('.delete-comment-btn')) {
    const btn = e.target.closest('.delete-comment-btn'),
      id = btn.dataset.commentId,
      event = relatedCache.comments.get(id);
    if (event) handleDelete(event, relatedCache.comments, `[data-comment-id="${id}"]`, btn);
  }
  
  if (e.target.closest('#delete-button') && proposal && userInfo?.pubkey === proposal.pubkey) {
    const btn = e.target.closest('#delete-button');
    setButtonLoading(btn, true);
    deleteEvent(
      proposal,
      handleEvent,
      () => history.back(),
      (error) => {
        setButtonLoading(btn, false);
        alert(error.message || 'Failed to delete proposal');
      }
    );
  }
});

// Listen for login events and reload page
window.addEventListener('userInfoUpdated', () => location.reload());

// Initialize
loadProposal();
