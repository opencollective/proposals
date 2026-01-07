import { setupScrollObserver, getTag, generateUId } from "./utils.js";
import { fetchGroups } from "./nostr-fetch.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

// DOM elements and state
const id = document.getElementById.bind(document),
  container = id("groups-container"), // Container for group cards
  stateEl = id("state"), // Status message element
  cache = new Map(), // Cache groups by UID to prevent duplicates
  savedUid = generateUId(JSON.parse(localStorage.getItem("group") || "{}")); // Currently selected group UID

// Pagination state
let newCount = 0, // Count of new groups loaded in current batch
  oldestTime = null; // Timestamp of oldest group for pagination

// Select a group and navigate back to previous page or home
const selectGroup = (uid) => {
  // Save selected group to localStorage
  localStorage.setItem("group", JSON.stringify(groupData));
  
  // Generate naddr for URL
  const dTag = getTag(groupData.tags, "d");
  let targetUrl = "/";
  
  if (dTag) {
    const naddr = NostrTools.nip19.naddrEncode({
      kind: groupData.kind,
      pubkey: groupData.pubkey,
      identifier: dTag
    });
    targetUrl = `/?group=${naddr}`;
  }
  
  // Update UI to show selected state
  document
    .querySelectorAll(".group-card")
    .forEach((c) => c.classList.toggle("selected", c.dataset.groupUid === uid));

  // Navigate to home with group parameter
  location.href = targetUrl;
};


// Render a group card in the UI
const groupCard = (uid, data) => {
  // Skip if card already exists
  if (document.querySelector(`[data-group-uid="${uid}"]`)) return;

  // Extract group metadata from tags
  const { tags } = data,
    name = getTag(tags, "name") || getTag(tags, "d") || "Unnamed Group",
    image = getTag(tags, "image"),
    desc = getTag(tags, "description");

  // Build card HTML with selected state if matches savedUid
  const card = `
    <div
      class="group-card ${savedUid === uid ? "selected" : ""}"
      data-group-uid="${uid}"
      onclick="selectGroup('${uid}')"
    >
      <img
        src="${image}"
        alt="${name}"
        class="group-image"
        onerror="this.src='/images/people.svg'"
      >
      <div class="group-content">
        <div class="group-name">${name}</div>
        ${desc ? `<div class="group-description">${desc}</div>` : ""}
      </div>
    </div>`;

  container.insertAdjacentHTML("beforeend", card);
};

// Handle incoming group events from relays
const handleGroup = (data) => {
  // Only process kind 34550 (group definition events)
  if (data.kind !== 34550) return;

  // Generate unique ID from pubkey + d-tag
  const uid = generateUId(data);
  if (!uid) return;

  // Skip if we have a newer version cached
  const cached = cache.get(uid);
  if (cached && cached.created_at >= data.created_at) return;

  // Update pagination state and cache
  newCount++;
  if (!oldestTime || data.created_at < oldestTime) oldestTime = data.created_at;
  cache.set(uid, data);
  groupCard(uid, data);
};

// Check if loading is complete and setup pagination if needed
const checkComplete = () => {
  if (newCount === 0) {
    // No new groups loaded - show completion message
    if (stateEl)
      stateEl.innerHTML = cache.size ? "All groups loaded" : "No groups found";
  } else if (newCount < 10) {
    // Less than 10 groups - load more immediately
    loadGroups();
  } else {
    // 10+ groups - setup infinite scroll for pagination
    setupScrollObserver(container, ".group-card", loadGroups);
  }
};

// Load groups from relays with pagination
const loadGroups = () => {
  newCount = 0; // Reset counter for new batch
  
  // Build query with pagination (until = oldest timestamp)
  const query = {};
  if (oldestTime) query.until = oldestTime;

  fetchGroups(query, handleGroup, checkComplete);
};

// Expose selectGroup globally for onclick handlers
window.selectGroup = selectGroup;

// Start loading groups on page load
loadGroups();

// Flow: loadGroups → fetchGroups → handleGroup (cache & render) → checkComplete (status/pagination) → selectGroup (save & navigate)
