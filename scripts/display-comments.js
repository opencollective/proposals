import * as NostrTools from "./nostr-tools.bundle.mjs";
import {
  linkifyNostr,
  getTag,
  getFromLocalStorage,
  setupDateFormatting,
} from "./utils.js";
import snarkdown from "./snarkdown.bundle.mjs";

// Display comment in the comments container with duplicate prevention
export const displayComment = (event, container) => {
  // Extract comment data
  const { id, content, created_at, pubkey, tags } = event,
    rootAuthor = getTag(tags, "p"), // Proposal author
    npub = NostrTools.nip19.npubEncode(pubkey),
    userInfo = getFromLocalStorage("userInfo"),
    isOwner = userInfo && pubkey === userInfo.pubkey; // Check if user owns comment

  // Check if comments container exists
  if (!container) return;
  if (container.classList.contains("hidden")) {
    container.classList.remove("hidden"); // Show container if hidden
  }

  // Prevent duplicates
  if (container.querySelector(`[data-comment-id="${id}"]`)) return false;

  const commentEl = `
    <div class="flex gap-lg" data-comment-id="${id}" data-pubkey="${pubkey}" data-created-at="${created_at}">
      <a href="/${npub}">
        <img class="user-image" src="https://robohash.org/${pubkey}.png?size=32x32">
      </a>
      <div class="grid gap-md flex-grow">
        <div class="flex gap-sm items-center py-xs related-item-header">
          <a href="/${npub}" class="user-name">Anonymous</a>
          ${pubkey === rootAuthor ? `<span class="author">Author</span>` : ""}
          <span>•</span>
          <span class="date" data-timestamp="${created_at}">${created_at}</span>
          ${
            isOwner
              ? `<button title="Delete comment" class="delete-comment-btn" data-comment-id="${id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 24">
                  <path fill="#656666" d="M11 0C9 0 7.3 1.6 7.3 3.6H.9c-.5 0-.9.4-.9.9s.4.9.9.9h1.5v15.3c0 1.8 1.5 3.3 3.4 3.3h10.4c1.8 0 3.4-1.5 3.4-3.3V5.4h1.5c.5 0 .9-.4.9-.9s-.4-.9-.9-.9h-6.4C14.7 1.6 13 0 11 0m0 1.8c1 0 1.8.8 1.8 1.8H9.1c0-1 .8-1.8 1.8-1.8M4.3 5.4h13.4v15.3c0 .8-.7 1.5-1.5 1.5H5.8c-.9 0-1.5-.7-1.5-1.5zm4.5 3c-.5 0-.9.4-.9.9v9c0 .5.4.9.9.9s.9-.4.9-.9v-9c0-.5-.4-.9-.9-.9m4.3 0c-.5 0-.9.4-.9.9v9c0 .5.4.9.9.9s.9-.4.9-.9v-9c0-.5-.4-.9-.9-.9"/>
                </svg>
              </button>`
              : ""
          }
        </div>
        <div class="comment-content text-sm markdown">
          ${snarkdown(linkifyNostr(content))}
        </div>
      </div>
    </div>
  `;

  // Add comment to container
  container.insertAdjacentHTML("beforeend", commentEl);

  // Sort comments by timestamp (oldest first)
  const comments = [...container.children].sort(
    (a, b) =>
      (parseInt(a.dataset.createdAt) || 0) -
      (parseInt(b.dataset.createdAt) || 0),
  );
  container.replaceChildren(...comments);

  // Format dates (relative time)
  setupDateFormatting(container);
  return true; // Return true if comment was added
};

// Flow: displayComment (extract data & check duplicates) → build HTML (with delete button if owner) → add to container → sort by timestamp → setupDateFormatting
