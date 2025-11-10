import { setupDateFormatting, normalizeReaction } from "./utils.js";

// Display reaction in the reactions container with duplicate prevention
export const displayReaction = (event, container) => {
  const { id, content, created_at, pubkey } = event;
  
  // Check if reactions container exists
  if (!container) return false;
  
  // Check for duplicates
  if (container.querySelector(`[data-reaction-id="${id}"]`)) return false;
  
  const emoji = normalizeReaction(content);
  
  const reactionEl = `
    <div class="flex gap-md items-center" data-reaction-id="${id}" data-pubkey="${pubkey}">
      <img class="user-image" src="https://robohash.org/${pubkey}.png?size=20x20">
      <span class="reaction-emoji">${emoji}</span>
      <div class="flex flex-wrap gap-sm items-center related-item-header">
        <div class="user-name text-sm">Anonymous</div>
        <span>•</span>
        <span class="date text-xs opacity-60" data-timestamp="${created_at}">${created_at}</span>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML("beforeend", reactionEl);
  setupDateFormatting(container);
  return true;
};