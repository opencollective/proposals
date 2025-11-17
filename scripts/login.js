import * as NostrTools from "./nostr-tools.bundle.mjs";
import { handleLogin } from "./auth-utils.js";

// Element References
const id = document.getElementById.bind(document),
  btnLogin = id("btn-login");

// Check if user is logged in
const checkLogin = () => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));
  if (!userInfo) return;

  // Remove existing profile if it exists
  const existingProfile = document.querySelector(".user-profile-info");
  if (existingProfile) {
    existingProfile.remove();
  }

  const { pubkey, npub, picture, display_name, displayName, name } = userInfo,
    userName = display_name || displayName || name || "Anonymous",
    defaultPic = `https://robohash.org/${pubkey}.png?size=20x20`,
    imgUrl = picture || defaultPic;

  document.querySelector(".login-content").innerHTML =
    `<div class="user-profile-info" data-pubkey="${pubkey}" data.profileCreated_at="">
      <a href="/${npub}" class="profile">
        <img class="user-image" src="${imgUrl}" onerror="this.src='${defaultPic}'" alt="User avatar" />
        <div class="user-name">${userName}</div>
      </a>
      <div id="btn-logout">Log out</div>
    </div>`;

  id("btn-logout").onclick = () => {
    localStorage.clear();
    location.reload();
  };
}

// Dispatch userInfoUpdated event when user info changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, arguments);
  if (key === 'userInfo') {
    window.dispatchEvent(new CustomEvent('userInfoUpdated'));
  }
};

// Login with Nostr extension or open login page
btnLogin && (
  btnLogin.onclick = () => {
    handleLogin(() => {
      checkLogin();
      window.dispatchEvent(new CustomEvent('userInfoUpdated'));
    });
  }
);

checkLogin(); // Check if user is logged in on page load

window.addEventListener('userInfoUpdated', checkLogin);

// This code is needed to restore the bunker signer authentication state from localStorage
// It allows users to maintain their authenticated session with the bunker service
// Without this, users would need to re-authenticate every time they refresh the page
(() => {
  const authData = localStorage.getItem("bunkerAuth");
  if (!authData) return;
  try {
    const { bp, secretKey, conversationKey } = JSON.parse(authData);
    const signer = new NostrTools.BunkerSigner(NostrTools.hexToBytes(secretKey), bp, {
      pool: new NostrTools.SimplePool()
    });
    signer.conversationKey = NostrTools.hexToBytes(conversationKey);
    window.bunkerSigner = signer;
  } catch {
    localStorage.removeItem("bunkerAuth");
  }
})();
