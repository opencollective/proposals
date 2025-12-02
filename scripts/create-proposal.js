import * as NostrTools from "./nostr-tools.bundle.mjs";
import { ensureUserProfile } from "./user-profile.js";
import { getFromLocalStorage, setButtonLoading, generateUId } from "./utils.js";
import {
  createProposal,
  updateProposal,
  updateProposalWithKindChange,
} from "./nostr-create.js";

// Form and user state
const form = document.getElementById("create-proposal"),
  userInfo = getFromLocalStorage("userInfo"),
  editProposal = getFromLocalStorage("editProposal") || null;

let group = getFromLocalStorage("group"),
  groupChecked = false;

// Ensure user has selected a group before creating proposal
const checkGroup = () => {
  if (groupChecked) return;
  groupChecked = true;

  group = getFromLocalStorage("group");
  if (!group) {
    alert("You need to select a group first");
    location.href = "/groups";
  }
};

// Check if user is logged in, hide form and show login prompt if not
if (!userInfo) {
  form.classList.add("hidden");
  form.parentElement.insertAdjacentHTML(
    "beforeend",
    `
    <div class="proposal-card-no-data">
      <div class="markdown">
        <h2>Login Required</h2>
        <p>You need to connect your digital identity to create proposals</p>
      </div>
      <button
        class="btn btn-primary"
        onclick="document.getElementById('btn-login').click()"
      >
        Connect your digital identity
      </button>
    </div>
  `,
  );

  // Show form when user logs in
  window.addEventListener("userInfoUpdated", () => {
    const newUserInfo = getFromLocalStorage("userInfo");
    if (newUserInfo) {
      form.classList.remove("hidden");
      document.querySelector(".proposal-card-no-data")?.remove();
      ensureUserProfile();
      setTimeout(checkGroup, 3000);
    }
  });
} else {
  ensureUserProfile();
  setTimeout(checkGroup, 3000);
}

// Prefill if editing
if (editProposal) {
  const { content, tags } = editProposal,
    title = tags.find((t) => t[0] === "title")?.[1] || "";

  form.querySelector("#title").value = title;
  form.querySelector("#description").value = content;

  localStorage.removeItem("editProposal"); // Clean up after prefill
}

// Generate unique ID for proposal 'd' tag (timestamp + random)
const generateUniqueId = () => {
    return (
      Date.now().toString(36) +
      Array.from(crypto.getRandomValues(new Uint8Array(8))).reduce(
        (s, b) => s + b.toString(36),
        "",
      )
    );
  },
  // Generate collision-proof order ID (12 chars base62 = 62^12 = 3.2×10^21 possibilities)
  // Can create 1 billion proposals/second for 100,000 years without collision
  generateUniqueOrder = () => {
    const chars =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
      timestamp = Date.now(),
      bytes = new Uint8Array(8);

    crypto.getRandomValues(bytes);
    let num = timestamp * 256 + bytes[0],
      result = "";

    for (let i = 0; i < 12; i++) {
      result = chars[num % 62] + result;
      num = Math.floor(num / 62);
      if (num === 0 && i < 11) num = bytes[i % 8];
    }

    return result;
  },
  // Convert title to URL-friendly slug
  slugify = (title) => {
    return title
      ?.toLowerCase()
      ?.trim()
      ?.replace(/[^a-z0-9\s-]/g, "")
      ?.replace(/\s+/g, "-")
      ?.replace(/-+/g, "-");
  };

// Redirect to proposal page after creation
const redirectToProposal = (event) => {
  const nevent = NostrTools.nip19.neventEncode({
    id: event.id,
    author: event.pubkey,
    kind: event.kind,
    relays: [...activeRelays],
  });
  location.href = `/${nevent}`;
};

// Handle proposal submission (create or update)
const handleSubmit = async (kind, button) => {
  if (!form.checkValidity()) return form.reportValidity();
  if (!userInfo) return alert("Please log in first");

  const title = form.querySelector("#title")?.value?.trim(),
    description = form.querySelector("#description")?.value?.trim();

  if (!title || !description)
    return alert("Title and description are required!");

  const groupUid = generateUId(group),
    groupKind = group.kind.toString(),
    groupPubkey = group.pubkey;

  setButtonLoading(button, true);

  const onError = () => setButtonLoading(button, false);

  try {
    // Build proposal tags
    const tags = [
      ["d", `proposal:${slugify(title)}-${generateUniqueId()}`],
      ["published_at", `${Math.floor(Date.now() / 1000)}`],
      ["title", title],
      ["z", generateUniqueOrder()],
      ["A", groupUid],
      ["P", groupPubkey],
      ["K", groupKind],
      ["a", groupUid],
      ["p", groupPubkey],
      ["k", groupKind],
      ["t", "proposal"],
      ["client", "Opencollective"],
    ];

    if (editProposal) {
      // Update existing proposal
      if (editProposal.kind !== kind) {
        // Kind changed: create new + delete old
        await updateProposalWithKindChange(
          { kind, content: description, title, originalProposal: editProposal },
          redirectToProposal,
          onError,
        );
      } else {
        // Same kind: just update
        await updateProposal(
          { content: description, title, originalProposal: editProposal },
          redirectToProposal,
          onError,
        );
      }
    } else {
      // Create new proposal
      await createProposal(
        { kind, content: description, tags },
        redirectToProposal,
        onError,
      );
    }
  } catch (error) {
    setButtonLoading(button, false);
    alert(error.message || "Failed to submit proposal");
  }
};

// Button handlers
document.getElementById("publish").onclick = (e) =>
  handleSubmit(30023, e.currentTarget); // Kind 30023 = published
document.getElementById("draft").onclick = (e) =>
  handleSubmit(30024, e.currentTarget); // Kind 30024 = draft

// Flow: Check login → ensureUserProfile → checkGroup (3s delay) → handleSubmit (validate & build tags) → createProposal/updateProposal/updateProposalWithKindChange → redirectToProposal
