import { displayComment } from "./display-comments.js";
import { displayReaction } from "./display-reactions.js";
// Handle OK responses from relays
export const handleOK = ([type, eventId, success]) => {
  if (type !== "OK" || !window.pendingEvents?.has(eventId)) return;
  
  const { event, onSuccess } = window.pendingEvents.get(eventId);
  
  if (success) {
    // Update UI based on event kind
    if (event.kind === 7) {
      displayReaction?.(event, document.querySelector(".reactions-container"));
    }
    
    if (event.kind === 1111) {
      displayComment?.(event, document.querySelector(".comments-container"));
    }
    
    if (event.kind === 5) {
      const targetId = event.tags.find(t => t[0] === "e")?.[1];
      document.querySelector(`[data-comment-id="${targetId}"], [data-reaction-id="${targetId}"]`)?.remove();
    }
    
    onSuccess?.();
  } else {
    // Show error for failed events
    const eventType = event.kind === 7 ? "reaction" : event.kind === 1111 ? "comment" : "event";
    alert(`Failed to post ${eventType}`);
  }
  
  window.pendingEvents.delete(eventId);
};