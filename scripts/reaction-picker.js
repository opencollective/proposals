// Available reactions
export const REACTIONS = {
  love: "❤️",
  like: "👍",
  dislike: "👎",
  happy: "😊",
  highfive: "🙏",
  rocket: "🚀",
  fire: "🔥",
};

// Picker state
let pickerElement = null; // Current picker element
let currentTarget = null; // Target element that triggered picker

// Create reaction picker element with all reaction buttons
const createPicker = () => {
  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  // Build buttons for each reaction
  picker.innerHTML = Object.entries(REACTIONS)
    .map(
      ([key, emoji]) =>
        `<button class="reaction-btn" data-reaction="${key}" title="${key}">${emoji}</button>`,
    )
    .join("");
  return picker;
};

// Show reaction picker above target element
export const showReactionPicker = (targetElement, onSelect) => {
  // Remove existing picker if any
  hideReactionPicker();

  // Create and position picker
  pickerElement = createPicker();
  currentTarget = targetElement;

  // Position picker above the target element
  const rect = targetElement.getBoundingClientRect();
  pickerElement.style.left = `${rect.left}px`;
  pickerElement.style.top = `${rect.top - 60}px`; // 60px above

  document.body.appendChild(pickerElement);

  // Add click handlers to reaction buttons
  pickerElement.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect(btn.dataset.reaction); // Call callback with selected reaction
      hideReactionPicker(); // Close picker
    });
  });

  // Close picker on outside click (delayed to avoid immediate close)
  setTimeout(() => {
    document.addEventListener("click", hideReactionPicker);
  }, 0);
};

// Hide and cleanup reaction picker
export const hideReactionPicker = () => {
  if (pickerElement) {
    pickerElement.remove(); // Remove from DOM
    pickerElement = null; // Clear reference
    currentTarget = null; // Clear target
    document.removeEventListener("click", hideReactionPicker); // Remove listener
  }
};

// Get emoji for reaction key
export const getReactionEmoji = (key) => REACTIONS[key] || key;

// Get content for reaction (love = '+', others = emoji)
export const getReactionContent = (key) =>
  key === "love" ? "+" : REACTIONS[key];

// Flow: showReactionPicker (create & position) → user clicks reaction → onSelect callback → hideReactionPicker (cleanup)
