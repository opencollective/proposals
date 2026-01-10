import { browse } from "./browse.js";
import {
  getFromLocalStorage,
  showSelectedGroup,
  generateUId,
} from "./utils.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";
import { fetchGroups } from "./nostr-fetch.js";

// Check for group parameter in URL
const urlParams = new URLSearchParams(window.location.search);
const groupParam = urlParams.get("group");

if (groupParam) {
  try {
    const { type, data } = NostrTools.nip19.decode(groupParam);
    if (type === "naddr" && data.kind === 34550) {
      const storedGroup = getFromLocalStorage("group");
      const urlUid = `${data.kind}:${data.pubkey}:${data.identifier}`;
      const storedUid = generateUId(storedGroup || {});
      
      // If URL group matches stored group, just show it
      if (urlUid === storedUid) {
        showSelectedGroup();
      } else {
        // Fetch the group from relays
        fetchGroups(
          { kinds: [34550], authors: [data.pubkey], "#d": [data.identifier] },
          (groupData) => {
            localStorage.setItem("group", JSON.stringify(groupData));
            showSelectedGroup();
          },
          () => {
            // If fetch fails, redirect to groups page
            window.location.href = "/groups";
          }
        );
      }
    } else {
      // Invalid group parameter, redirect to groups page
      window.location.href = "/groups";
    }
  } catch (e) {
    console.error("Invalid group parameter", e);
    window.location.href = "/groups";
  }
} else {
  // No group parameter, show selected group if any
  showSelectedGroup();
}

// Get user info from localStorage
const userInfo = getFromLocalStorage("userInfo");

// Initialize browse functionality and load proposals
const browser = browse();
browser.load();

// Flow: Check group param → decode → match or fetch → show group → Check login → update UI → browse.load() → fetch & display proposals
