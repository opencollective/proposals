import { getFromLocalStorage } from "./utils.js";
import { browse } from "./browse.js";

// Update create proposal button based on login status
const updateCreateButton = () => {
  const userInfo = getFromLocalStorage("userInfo");
  if (userInfo?.pubkey) {
    document.querySelector(".proposal-btn-lg-container").classList.remove("hidden");
    const proposalBtn = document.querySelector(".proposal-btn-lg");
    const img = proposalBtn?.querySelector("img");
    if (proposalBtn) proposalBtn.setAttribute("data-pubkey", userInfo.pubkey);
    if (img && userInfo.picture) img.src = userInfo.picture;
  }
}

// Initialize profile button on page load
updateCreateButton();

// Listen for user info updates
window.addEventListener('userInfoUpdated', updateCreateButton);

// Browse proposals
const browser = browse();
browser.load();