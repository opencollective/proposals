import { getFromLocalStorage, setButtonLoading } from "./utils.js";
import { createProposal, updateProposal, updateProposalWithKindChange } from "./nostr-create.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

// Track events
window.pendingEvents = window.pendingEvents || new Map();

const form = document.getElementById("create-proposal"),
  userInfo = getFromLocalStorage("userInfo"),
  editProposal = JSON.parse(localStorage.getItem('editProposal') || 'null');

// Prefill if editing
if (editProposal) {
  const { content, tags } = editProposal,
    title = tags.find(t => t[0] === 'title')?.[1] || '';
  
  form.querySelector('#title').value = title;
  form.querySelector('#description').value = content;
  
  localStorage.removeItem('editProposal'); // Clean up after prefill
} 

const generateUniqueId = () => {
    return (
      Date.now().toString(36) +
      Array.from(crypto.getRandomValues(new Uint8Array(8))).reduce(
        (s, b) => s + b.toString(36),
        "",
      )
    );
  },
  generateUniqueOrder = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      len = 4 + Math.floor(Math.random() * 5), // 4–8 chars
      rand = Array.from(
        crypto.getRandomValues(new Uint8Array(len)),
        (b) => chars[b % 36],
      ).join(""),
      time = Date.now().toString(36).slice(-2).toUpperCase();
    return (rand + time).slice(0, len);
  },
  slugify = (title) => {
    return title
      ?.toLowerCase()
      ?.trim()
      ?.replace(/[^a-z0-9\s-]/g, "")
      ?.replace(/\s+/g, "-")
      ?.replace(/-+/g, "-");
  };

let mainEvent = null;

const handleEvent = ([type, eventId, data]) => {
  if (type === "OK" && data) {
    const pendingEvent = window.pendingEvents.get(eventId);
    if (!pendingEvent) return;
    
    window.pendingEvents.delete(eventId); // Remove processed
    
    if (!mainEvent) mainEvent = pendingEvent.event; // Store main
    
    if (pendingEvent.onSuccess) {
      pendingEvent.onSuccess(); // Trigger delete
    } else if (window.pendingEvents.size === 0) {
      const nevent = NostrTools.nip19.neventEncode({ 
        id: mainEvent.id, 
        author: mainEvent.pubkey, 
        kind: mainEvent.kind,
        relays: [...activeRelays] 
      });
      location.href = `/${nevent}`; // Redirect
    }
  }
};

const handleSubmit = async (kind, button) => {
  if (!form.checkValidity()) return form.reportValidity();
  if (!userInfo) return alert("Please log in first");

  const title = form.querySelector("#title")?.value?.trim(),
    description = form.querySelector("#description")?.value?.trim();

  if (!title || !description) return alert("Title and description are required!");

  setButtonLoading(button, true);

  const onError = () => setButtonLoading(button, false);

  try {
    const tags = [
      ["d", `opencollective-proposal:${slugify(title)}-${generateUniqueId()}`],
      ["published_at", `${Math.floor(Date.now() / 1000)}`],
      ["title", title],
      ["z", generateUniqueOrder()],
      ["t", "proposal"],
      ["client", "Opencollective"],
    ];

    if (editProposal) {
      if (editProposal.kind !== kind) {
        await updateProposalWithKindChange({ kind, content: description, title, originalProposal: editProposal }, handleEvent, onError);
      } else {
        await updateProposal({ content: description, title, originalProposal: editProposal }, handleEvent, onError);
      }
    } else {
      await createProposal({ kind, content: description, tags }, handleEvent, onError);
    }
  } catch (error) {
    setButtonLoading(button, false);
    alert(error.message || "Failed to submit proposal");
  }
};

document.getElementById("publish").onclick = (e) => handleSubmit(30023, e.currentTarget);
document.getElementById("draft").onclick = (e) => handleSubmit(30024, e.currentTarget);