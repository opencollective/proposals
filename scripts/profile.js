import * as NostrTools from "./nostr-tools.bundle.mjs";
import { browse } from "./browse.js";
import { updateProfile } from "./update-profile.js";
import {
  getFromLocalStorage,
  updateCreateButton,
  showSelectedGroup,
} from "./utils.js";

// Extract npub from URL path
const query = document.querySelector.bind(document),
  npub = window.location.pathname.slice(1).split("?")[0];

// Decode npub to get pubkey and validate
let profilePubkey;
try {
  if (npub.startsWith("npub")) {
    profilePubkey = NostrTools.nip19.decode(npub).data; // Decode npub to hex pubkey
    query(".user-profile").setAttribute("data-pubkey", profilePubkey);
  }
} catch (error) {
  alert("Invalid npub");
  window.location.href = "/";
}

// Redirect if no valid pubkey
if (!profilePubkey) {
  alert("Invalid profile URL");
  window.location.href = "/";
}

// Check if viewing own profile
let isOwner = getFromLocalStorage("userInfo")?.pubkey === profilePubkey;

// Display selected group in UI
showSelectedGroup();

// Set up filters for profile proposals
const filters = {
  authors: [profilePubkey], // Only show proposals by this user
  kinds: isOwner ? [30023, 30024] : [30023], // Show drafts (30024) only if owner
};

// Initialize browse with profile filters and load proposals
const browser = browse({ filters, fetchProfileFirst: profilePubkey });
browser.load();

// Update UI elements if viewing own profile (after browse loads profile)
const updateOwnProfile = () => {
  const wasOwner = isOwner;
  isOwner = getFromLocalStorage("userInfo")?.pubkey === profilePubkey;
  
  if (isOwner) {
    updateCreateButton(); // Show create button
    updateProfile(profilePubkey, true); // Enable edit mode
    
    // Reload page if user just logged in to their own profile
    if (!wasOwner) {
      location.reload();
    }
  }
};

// Listen for login/logout events to update own profile UI
window.addEventListener("userInfoUpdated", updateOwnProfile);

// Flow: Extract npub → NostrTools.nip19.decode (to pubkey) → check ownership → showSelectedGroup → browse.load() → fetchProposals & fetchProfiles → delayed updateOwnProfile (UI setup & reload if just logged in) → handleProposal (cache & render) → fetchRelated (reactions/comments)
