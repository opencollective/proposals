import { normalizeReaction } from "./utils.js";

// Attach or remove reactions/comments to proposal cards in browse/profile pages
export const attachRelatedKind = (
  { id, kind, tags, content, pubkey },
  isDelete = false,
) => {
  // Find proposal reference (a-tag or e-tag)
  const tag = tags.find(([t]) => t === "a" || t === "e");
  if (!tag) return;

  // Find proposal card element
  const noteEl = document.querySelector(`[data-proposals-uid="${tag[1]}"]`);
  if (!noteEl) return;

  // Determine type: kind 7 = reactions, kind 1111 = comments
  const type = kind === 7 ? "reactions" : "comments",
    countEl = noteEl.querySelector(`.${type} .count`);
  if (!countEl) return;

  // Get existing reactions/comments from dataset
  const existing = JSON.parse(noteEl.dataset[type] || "{}");

  // Update existing data: delete or add
  if (isDelete) {
    delete existing[id];
  } else if (
    (kind === 7 && content && !existing[id]) ||
    (kind === 1111 && !existing[id])
  ) {
    existing[id] = { content: content || "", pubkey };
  }

  // Save updated data back to dataset
  noteEl.dataset[type] = JSON.stringify(existing);

  // Update UI: reactions show icon, comments show count
  if (kind === 7) {
    updateReactionSummary(noteEl, existing);
  } else {
    countEl.textContent = Object.keys(existing).length;
  }
};

// Update reaction icon and count for a proposal card
const updateReactionSummary = (noteEl, reactions) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  let userReaction = null;

  // Find current user's reaction
  Object.values(reactions).forEach(({ content, pubkey }) => {
    if (pubkey === userInfo.pubkey) userReaction = content.trim();
  });

  const iconEl = noteEl.querySelector(".reactions .icon");
  const countEl = noteEl.querySelector(".reactions .count");

  // Update icon: show user's reaction or default heart
  if (iconEl) {
    iconEl.textContent = userReaction ? normalizeReaction(userReaction) : "🤍";
    iconEl.classList.toggle("active", !!userReaction);
  }

  // Update count
  countEl.textContent = Object.keys(reactions).length || "";
};

// Flow: attachRelatedKind (find proposal card) → update dataset → updateReactionSummary (update icon & count) or update comment count
