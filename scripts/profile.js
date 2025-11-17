import * as NostrTools from "./nostr-tools.bundle.mjs";
import { getFromLocalStorage, updateCreateButton } from "./utils.js";
import { browse } from "./browse.js";
import { updateProfile } from "./update-profile.js";

// Get npub from URL
const query = document.querySelector.bind(document),
  npub = window.location.pathname.slice(1).split("?")[0];

// Decode npub to get pubkey
let profilePubkey;
try {
  if (npub.startsWith("npub")) {
    profilePubkey = NostrTools.nip19.decode(npub).data;
    query(".user-profile").setAttribute("data-pubkey", profilePubkey);
  }
} catch (error) {
  alert("Invalid npub");
  window.location.href = "/";
}

if (!profilePubkey) {
  alert("Invalid profile URL");
  window.location.href = "/";
}

const userInfo = getFromLocalStorage("userInfo"),
  isOwner = userInfo?.pubkey === profilePubkey;

// Update profile elements if viewing own profile based on login status
const updateOwnProfile = () => {
  if (isOwner) {
    updateCreateButton();
    updateProfile(profilePubkey, true);
  }
};

updateOwnProfile();

// Listen for user info updates
window.addEventListener('userInfoUpdated', updateOwnProfile);

// Set up profile-specific filters
const filters = {
  authors: [profilePubkey],
  kinds: isOwner ? [30023, 30024] : [30023],
};

// Browse profile proposals and fetch profile first
const browser = browse({ filters, fetchProfileFirst: profilePubkey });
browser.load();