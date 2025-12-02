import * as NostrTools from "./nostr-tools.bundle.mjs";
import { handleLogin } from "./auth-utils.js";
import { getFromLocalStorage } from "./utils.js";

// Initialize global profile cache
window.profileCache = window.profileCache || new Map();

// Add user pubkey to cache for automatic fetching
const addUserToCache = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (userInfo?.pubkey && !window.profileCache.has(userInfo.pubkey)) {
    window.profileCache.set(userInfo.pubkey, {});
  }
};

// DOM element references
const id = document.getElementById.bind(document),
  btnLogin = id("btn-login");

// Update UI when user info changes
const updateUI = () => {
  checkLogin();
  addUserToCache();
};

// Check if user is logged in and render profile UI
const checkLogin = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (!userInfo) return;

  // Extract user info with fallbacks
  const { pubkey, npub, picture, display_name, displayName, name } = userInfo,
    userName = display_name || displayName || name || "Anonymous";

  // Render user profile with logout button
  document.querySelector(".login-content").innerHTML =
    `<div
      class="user-profile-info"
      data-pubkey="${pubkey}"
      data-profile-created-at="${userInfo.created_at || 0}"
    >
      <a href="/${npub}" class="profile" title="${userName}">
        <img
          class="user-image" src="${picture}"
          alt="User avatar"
          onerror="this.src='https://robohash.org/${pubkey}.png?size=20x20&bgset=bg2'"
        />
        <div class="user-name profile-name">${userName}</div>
      </a>
      <div id="btn-logout">Log out</div>
    </div>`;

  // Handle logout
  id("btn-logout").onclick = () => {
    localStorage.clear();
    location.reload();
  };
}

// Override localStorage.setItem to dispatch event when userInfo changes
// This allows other components to react to profile updates
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, arguments);
  if (key === 'userInfo') {
    window.dispatchEvent(new CustomEvent('userInfoUpdated'));
  }
};

// Handle login button click
btnLogin && (btnLogin.onclick = () => handleLogin(() => {
  updateUI();
}));

updateUI(); // Initialize UI on page load

// Listen for userInfo updates from any source
window.addEventListener('userInfoUpdated', updateUI);

// Restore bunker signer authentication state from localStorage
// Maintains authenticated session across page refreshes
// Without this, users would need to re-authenticate every time they refresh the page
(() => {
  const authData = getFromLocalStorage("bunkerAuth");
  if (!authData) return;
  try {
    const { bp, secretKey, conversationKey } = authData,
      signer = new NostrTools.BunkerSigner(NostrTools.hexToBytes(secretKey), bp, {
        pool: new NostrTools.SimplePool()
      });
    signer.conversationKey = NostrTools.hexToBytes(conversationKey);
    window.bunkerSigner = signer;
  } catch {
    localStorage.removeItem("bunkerAuth");
  }
})();
