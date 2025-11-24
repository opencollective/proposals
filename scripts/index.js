import { getFromLocalStorage, updateCreateButton, showSelectedGroup } from "./utils.js";
import { browse } from "./browse.js";

const userInfo = getFromLocalStorage("userInfo");

// Initialize profile button on page load based on login status
if (userInfo?.pubkey) updateCreateButton();

// Listen for user info updates
window.addEventListener('userInfoUpdated', updateCreateButton);

showSelectedGroup();

const browser = browse();
browser.load();