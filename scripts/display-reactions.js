import { setupDateFormatting, normalizeReaction } from "./utils.js";

// Display reaction in the reactions container with duplicate prevention
export const displayReaction = (event, container) => {
  // Extract reaction data
  const { id, content, created_at, pubkey } = event;

  // Check if reactions container exists
  if (!container) return false;

  // Prevent duplicates
  if (container.querySelector(`[data-reaction-id="${id}"]`)) return false;

  // Normalize emoji (convert +1/-1 to thumbs up/down)
  const emoji = normalizeReaction(content);

  const reactionEl = `
    <div class="flex gap-md items-center" data-reaction-id="${id}" data-pubkey="${pubkey}" data-created-at="${created_at}">
      <img class="user-image" src="https://robohash.org/${pubkey}.png?size=20x20">
      <span class="reaction-emoji">${emoji}</span>
      <div class="flex flex-wrap gap-sm items-center related-item-header">
        <div class="user-name text-sm">Anonymous</div>
        <span>•</span>
        <span class="date text-xs opacity-60" data-timestamp="${created_at}">${created_at}</span>
      </div>
    </div>
  `;

  // Add reaction to container
  container.insertAdjacentHTML("beforeend", reactionEl);

  // Sort reactions by timestamp (oldest first)
  const reactions = [...container.children].sort(
    (a, b) =>
      (parseInt(a.dataset.createdAt) || 0) -
      (parseInt(b.dataset.createdAt) || 0),
  );
  container.replaceChildren(...reactions);

  // Format dates (relative time)
  setupDateFormatting(container);
  return true; // Return true if reaction was added
};

// Flow: displayReaction (extract data & check duplicates) → normalizeReaction (emoji) → build HTML → add to container → sort by timestamp → setupDateFormatting
