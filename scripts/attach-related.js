import { normalizeReaction } from "./utils.js";

export const attachRelatedKind = ({ id, kind, tags, content, pubkey }, isDelete = false) => {
  const tag = tags.find(([t]) => t === "a" || t === "e");
  if (!tag) return;
  const noteEl = document.querySelector(`[data-proposals-uid="${tag[1]}"]`);
  if (!noteEl) return;
  
  const type = kind === 7 ? "reactions" : "comments",
    countEl = noteEl.querySelector(`.${type} .count`);
  if (!countEl) return;
  
  const existing = JSON.parse(noteEl.dataset[type] || "{}");
  
  if (isDelete) {
    delete existing[id];
  } else if ((kind === 7 && content && !existing[id]) || (kind === 1111 && !existing[id])) {
    existing[id] = { content: content || "", pubkey };
  }
  
  noteEl.dataset[type] = JSON.stringify(existing);
  
  if (kind === 7) {
    updateReactionSummary(noteEl, existing);
  } else {
    countEl.textContent = Object.keys(existing).length;
  }
};

const updateReactionSummary = (noteEl, reactions) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  let userReaction = null;
  
  Object.values(reactions).forEach(({ content, pubkey }) => {
    if (pubkey === userInfo.pubkey) userReaction = content.trim();
  });
  
  const iconEl = noteEl.querySelector('.reactions .icon');
  const countEl = noteEl.querySelector('.reactions .count');
  
  if (iconEl) {
    iconEl.textContent = userReaction ? normalizeReaction(userReaction) : '🤍';
    iconEl.classList.toggle('active', !!userReaction);
  }
  countEl.textContent = Object.keys(reactions).length || '';
};