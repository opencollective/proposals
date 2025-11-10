export const REACTIONS = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  happy: '😊',
  highfive: '🙏',
  rocket: '🚀',
  fire: '🔥',
};

let pickerElement = null;
let currentTarget = null;

// Create reaction picker element
const createPicker = () => {
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.innerHTML = Object.entries(REACTIONS)
    .map(([key, emoji]) => `<button class="reaction-btn" data-reaction="${key}" title="${key}">${emoji}</button>`)
    .join('');
  return picker;
};

// Show reaction picker
export const showReactionPicker = (targetElement, onSelect) => {
  // Remove existing picker
  hideReactionPicker();
  
  pickerElement = createPicker();
  currentTarget = targetElement;
  
  // Position picker above the target
  const rect = targetElement.getBoundingClientRect();
  pickerElement.style.left = `${rect.left}px`;
  pickerElement.style.top = `${rect.top - 60}px`;
  
  document.body.appendChild(pickerElement);
  
  pickerElement.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(btn.dataset.reaction);
      hideReactionPicker();
    });
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', hideReactionPicker);
  }, 0);
};

// Hide reaction picker
export const hideReactionPicker = () => {
  if (pickerElement) {
    pickerElement.remove();
    pickerElement = null;
    currentTarget = null;
    document.removeEventListener('click', hideReactionPicker);
  }
};

export const getReactionEmoji = (key) => REACTIONS[key] || key;

export const getReactionContent = (key) => key === 'love' ? '+' : REACTIONS[key];
