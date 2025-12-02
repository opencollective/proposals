import { setButtonLoading } from "./utils.js";
import { updateProfile } from "./update-profile.js";
import { attachRelatedKind } from "./attach-related.js";
import { handleRelated, processRelated } from "./event-handlers.js";
import { showReactionPicker, getReactionContent } from "./reaction-picker.js";
import { createReaction, createComment, deleteEvent } from "./nostr-create.js";

// Setup all user interactions for proposal page (comments, reactions, delete)
export const setupInteractions = (proposal, userInfo) => {
  const query = document.querySelector.bind(document),
    // Containers for displaying reactions and comments
    containers = {
      reactions: query(".reactions-container"),
      comments: query(".comments-container"),
    },
    // Display event after creation and update profile
    displayEvent = (msg) => {
      // Handle OK responses from relay (for delete operations)
      if (Array.isArray(msg) && msg[0] === "OK") {
        const [, eventId, success] = msg;
        if (success && window.pendingEvents?.has(eventId)) {
          const { onSuccess } = window.pendingEvents.get(eventId);
          window.pendingEvents.delete(eventId);
          onSuccess?.();
        }
        return;
      }
      // Handle regular events (reactions/comments)
      handleRelated(msg, (data) => {
        processRelated(data, containers); // Display in UI
        updateProfile(data.pubkey, data.pubkey === userInfo?.pubkey); // Update profile
      });
    },
    // Submit comment with loading state
    submitComment = (content) => {
      const btn = query("#btn-submit-comment");
      setButtonLoading(btn, true); // Show loading
      createComment(
        proposal,
        content,
        displayEvent, // Display after creation
        () => {
          query("#comment-input").value = ""; // Clear input
          setButtonLoading(btn, false); // Hide loading
        },
        () => setButtonLoading(btn, false), // Hide loading on error
      );
    },
    // Submit reaction (no loading state needed)
    submitReaction = (content) =>
      createReaction(proposal, content, displayEvent),
    // Delete event (comment/reaction/proposal)
    handleDelete = (event, selector, btn) => {
      if (btn) setButtonLoading(btn, true); // Show loading if button provided
      deleteEvent(
        event,
        displayEvent,
        () => {
          query(selector)?.remove(); // Remove from UI
          attachRelatedKind(event, true); // Update counts in proposal cards
        },
        () => btn && setButtonLoading(btn, false), // Hide loading on error
      );
    };

  // Comment submission button handler
  query("#btn-submit-comment")?.addEventListener("click", () => {
    const content = query("#comment-input")?.value?.trim();
    if (content) submitComment(content); // Submit if not empty
  });

  // Event delegation for all click interactions
  document.addEventListener("click", (e) => {
    // Reaction button - toggle user's reaction
    if (e.target.closest(".reaction-item.reactions .icon")) {
      e.stopPropagation();
      if (!userInfo) return; // Not logged in

      // Check if user already reacted
      const existing = Array.from(relatedCache.reactions.values()).find(
        (r) => r.pubkey === userInfo.pubkey,
      );

      if (existing) {
        handleDelete(existing, `[data-reaction-id="${existing.id}"]`); // Remove reaction
      } else {
        // Show reaction picker
        showReactionPicker(
          e.target.closest(".reaction-item.reactions .icon"),
          (key) => submitReaction(getReactionContent(key)),
        );
      }
    }

    // Delete comment button
    if (e.target.closest(".delete-comment-btn")) {
      const btn = e.target.closest(".delete-comment-btn"),
        event = relatedCache.comments.get(btn.dataset.commentId); // Get comment from cache
      if (event) handleDelete(event, `[data-comment-id="${event.id}"]`, btn);
    }

    // Delete proposal button (only for proposal author)
    if (
      e.target.closest("#delete-button") &&
      proposal &&
      userInfo?.pubkey === proposal.pubkey // Check ownership
    ) {
      const btn = e.target.closest("#delete-button");
      setButtonLoading(btn, true);
      deleteEvent(
        proposal,
        displayEvent,
        () => history.back(), // Go back after deletion
        () => {
          setButtonLoading(btn, false);
          alert("Failed to delete proposal");
        },
      );
    }
  });
};

// Flow: setupInteractions (setup handlers) → user clicks → submitComment/submitReaction/handleDelete → createComment/createReaction/deleteEvent → displayEvent (update UI) → processRelated & updateProfile
