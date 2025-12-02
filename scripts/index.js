import { browse } from "./browse.js";
import {
  getFromLocalStorage,
  updateCreateButton,
  showSelectedGroup,
} from "./utils.js";

// Get user info from localStorage
const userInfo = getFromLocalStorage("userInfo");

// Initialize create button on page load if user is logged in
if (userInfo?.pubkey) updateCreateButton();

// Listen for login/logout events to update create button
window.addEventListener("userInfoUpdated", updateCreateButton);

// Display selected group in UI
showSelectedGroup();

// Initialize browse functionality and load proposals
const browser = browse();
browser.load();

// Flow: Check login → update UI → show group → browse.load() → fetch & display proposals
