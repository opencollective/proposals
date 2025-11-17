import sendMessage from "./send-message.js";
import { getFromLocalStorage, generateUId } from "./utils.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

const userInfo = getFromLocalStorage("userInfo"),
  bunkerAuth = getFromLocalStorage("bunkerAuth");

// Track pending events
window.pendingEvents = window.pendingEvents || new Map();

async function createBunkerSign(event) {
  if(!bunkerAuth) return alert("Bunker authentication not found, please login again");

  const pool = new NostrTools.SimplePool(),
    localPrivKey = NostrTools.hexToBytes(bunkerAuth.secretKey),
    conversationKey = NostrTools.hexToBytes(bunkerAuth.conversationKey),
    bunkerPointer = bunkerAuth.bp,
    signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, { pool });

  signer.conversationKey = conversationKey;
  signer.cachedPubKey = bunkerPointer.pubkey;
  signer.isOpen = true;
  signer.waitingForAuth = {};

  const fallbackPopup = setTimeout(() => {
    alert(`Please approve a new kind (${event.kind}) request in your Bunker (a popup may appear). then try again`);
  }, 3000);

  const signedEvent = await signer.signEvent(event);
  clearTimeout(fallbackPopup);

  return signedEvent;
}

// Create and send event
const create = async (kind, content, tags, handleEvent, onSuccess, onError) => {
  try {
    if (!window.nostr && !userInfo?.bunkerSigner) {
      const error = new Error("Please connect your nostr profile first");
      if (onError) onError(error);
      else alert(error.message);
      return;
    }

    const event = {
      kind,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
    
    const signed = !userInfo?.bunkerSigner
      ? await nostr.signEvent(event)
      : await createBunkerSign(event);

    window.pendingEvents.set(signed.id, { event: signed, onSuccess });
    sendMessage(JSON.stringify(["EVENT", signed]), handleEvent);
  } catch (error) {
    if (onError) onError(error);
    else alert(error.message || 'Failed to create event');
  }
};

// Build proposal tags
const buildTags = (title, originalTags = [], updatePublishedAt = false) => {
  return originalTags.map((tag) => {
    if (tag[0] === "title") return ["title", title];
    if (tag[0] === "published_at" && updatePublishedAt)
      return ["published_at", Math.floor(Date.now() / 1000).toString()];
    return tag;
  });
};

// Event creators
export const createReaction = (proposal, content, handleEvent) => {
  const { id, pubkey } = proposal,
    tags = [
      ["a", generateUId(proposal)],
      ["e", id],
      ["p", pubkey],
    ];
  create(7, content, tags, handleEvent);
};

export const createComment = (proposal, content, handleEvent, onSuccess, onError) => {
  const { id, kind, pubkey } = proposal,
    uid = generateUId(proposal),
    tags = [
      ["A", uid],
      ["K", kind.toString()],
      ["P", pubkey],
      ["a", uid],
      ["e", id],
      ["p", pubkey]
    ];
  create(1111, content, tags, handleEvent, onSuccess, onError);
};

export const deleteEvent = async (event, handleEvent, onSuccess, onError) => {
  try {
    const tags = [
      ["e", event.id],
      ["k", event.kind.toString()],
    ];
    if (event.kind === 30023 || event.kind === 30024)
      tags.unshift(["a", generateUId(event)]);
    await create(5, "", tags, handleEvent, onSuccess, onError);
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
};

export const createProposal = ({ kind, content, tags }, handleEvent, onError) =>
  create(kind, content, tags, handleEvent, null, onError);

export const updateProposal = (
  { content, title, originalProposal },
  handleEvent,
  onError
) => {
  const tags = buildTags(title, originalProposal.tags);
  create(originalProposal.kind, content, tags, handleEvent, null, onError);
};

export const updateProposalWithKindChange = (
  { kind, content, title, originalProposal },
  handleEvent,
  onError
) => {
  const tags = buildTags(title, originalProposal.tags, true),
    onSuccess = () => deleteEvent(originalProposal, handleEvent, null, onError);
  create(kind, content, tags, handleEvent, onSuccess, onError);
};
