import sendMessage from "./send-message.js";
import { getFromLocalStorage, generateUId } from "./utils.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

// Get user info and bunker auth from localStorage
const userInfo = getFromLocalStorage("userInfo"),
  bunkerAuth = getFromLocalStorage("bunkerAuth");

// Sign event using bunker (remote signer)
async function createBunkerSign(event) {
  if (!bunkerAuth)
    return alert("Bunker authentication not found, please login again");

  // Restore bunker signer from saved auth data
  const pool = new NostrTools.SimplePool(),
    localPrivKey = NostrTools.hexToBytes(bunkerAuth.secretKey),
    conversationKey = NostrTools.hexToBytes(bunkerAuth.conversationKey),
    bunkerPointer = bunkerAuth.bp,
    signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, { pool });

  // Set signer state from saved data
  signer.conversationKey = conversationKey;
  signer.cachedPubKey = bunkerPointer.pubkey;
  signer.isOpen = true;
  signer.waitingForAuth = {};

  // Show alert after 3s if bunker approval is needed
  const fallbackPopup = setTimeout(() => {
    alert(
      `Please approve a new kind (${event.kind}) request in your Bunker (a popup may appear). then try again`,
    );
  }, 3000);

  const signedEvent = await signer.signEvent(event);
  clearTimeout(fallbackPopup);

  return signedEvent;
}

// Create and send event to relays
const create = async (kind, content, tags, handleEvent, onSuccess, onError) => {
  try {
    // Check if user is logged in
    if (!window.nostr && !userInfo?.bunkerSigner) {
      const error = new Error("Please connect your nostr profile first");
      onError?.(error) || alert(error.message);
      return;
    }

    // Build unsigned event
    const event = {
      kind,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Sign with extension or bunker
    const signed = !userInfo?.bunkerSigner
      ? await nostr.signEvent(event)
      : await createBunkerSign(event);

    // Send to relays and call callbacks once
    let called = false;
    sendMessage(JSON.stringify(["EVENT", signed]), (msg) => {
      if (called) return; // Prevent multiple calls
      called = true;
      handleEvent?.(signed); // Handle signed event
      onSuccess?.(); // Call success callback
    });
  } catch (error) {
    onError?.(error) || alert(error.message || "Failed to create event");
  }
};

// Build proposal tags for update (replace title and optionally published_at)
const buildTags = (title, originalTags = [], updatePublishedAt = false) => {
  return originalTags.map((tag) => {
    if (tag[0] === "title") return ["title", title]; // Update title
    if (tag[0] === "published_at" && updatePublishedAt)
      return ["published_at", Math.floor(Date.now() / 1000).toString()]; // Update timestamp
    return tag; // Keep other tags unchanged
  });
};

// Create reaction (kind 7) for a proposal
export const createReaction = (
  proposal,
  content,
  handleEvent,
  onSuccess,
  onError,
) => {
  const { id, pubkey } = proposal,
    tags = [
      ["a", generateUId(proposal)], // Proposal UID
      ["e", id], // Event ID
      ["p", pubkey], // Author pubkey
    ];
  create(7, content, tags, handleEvent, onSuccess, onError);
};

// Create comment (kind 1111) for a proposal
export const createComment = (
  proposal,
  content,
  handleEvent,
  onSuccess,
  onError,
) => {
  const { id, kind, pubkey } = proposal,
    uid = generateUId(proposal),
    tags = [
      ["A", uid], // Uppercase tags for filtering
      ["K", kind.toString()],
      ["P", pubkey],
      ["a", uid], // Lowercase tags for references
      ["e", id],
      ["p", pubkey],
    ];
  create(1111, content, tags, handleEvent, onSuccess, onError);
};

// Delete event (kind 5)
export const deleteEvent = async (event, handleEvent, onSuccess, onError) => {
  try {
    // Build deletion tags
    const tags = [
      ["e", event.id], // Event ID to delete
      ["k", event.kind.toString()], // Event kind
    ];
    // Add 'a' tag for addressable events (proposals)
    if (event.kind === 30023 || event.kind === 30024)
      tags.unshift(["a", generateUId(event)]);
    await create(5, "", tags, handleEvent, onSuccess, onError);
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
};

// Create new proposal
export const createProposal = ({ kind, content, tags }, handleEvent, onError) =>
  create(kind, content, tags, handleEvent, null, onError);

// Update existing proposal (same kind)
export const updateProposal = (
  { content, title, originalProposal },
  handleEvent,
  onError,
) => {
  const tags = buildTags(title, originalProposal.tags); // Update title only
  create(originalProposal.kind, content, tags, handleEvent, null, onError);
};

// Update proposal with kind change (draft ↔ published)
export const updateProposalWithKindChange = async (
  { kind, content, title, originalProposal },
  handleEvent,
  onError,
) => {
  const tags = buildTags(title, originalProposal.tags, true); // Update title and published_at

  // Create new proposal, then delete old one, then redirect
  let newEvent = null;
  const onCreateSuccess = () => {
    deleteEvent(
      originalProposal,
      () => {},
      () => handleEvent(newEvent),
      onError,
    );
  };

  await create(
    kind,
    content,
    tags,
    (event) => {
      newEvent = event;
    },
    onCreateSuccess,
    onError,
  );
};

// Flow: create (build & sign event) → sendMessage (send to relays) → handleEvent & onSuccess callbacks
