export const updateProfile = (pubkey, user = false) => {
  // Init cache and get userInfo
  window.profileCache = window.profileCache || new Map();
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
  
  // Get profile from userInfo or cache, fallback to userInfo for own profile
  let profile = user ? userInfo : window.profileCache.get(pubkey);
  if (!profile && userInfo?.pubkey === pubkey) {
    profile = userInfo;
    user = true;
  }
  if (!profile) return;
  
  // Helper to get display name
  const getName = (p) => p.display_name || p.displayName || p.name || "Anonymous";
  // Init vars
  let picture, userName = "Anonymous", created_at = Date.now();
  
  // Handle userInfo structure
  if (user) {
    ({ picture, created_at } = profile);
    userName = getName(profile);
    created_at = created_at || Date.now();
  // Handle profile cache structure
  } else if (profile.content) {
    try {
      const data = JSON.parse(profile.content);
      picture = data.picture;
      userName = getName(data);
      created_at = profile.created_at;
    } catch (e) {}
  }
  
  // Update breadcrumb for profile pages
  if (window.location.pathname.slice(1).startsWith("npub")) {
    const breadcrumb = document.querySelector(".breadcrumb-item.current");
    if (breadcrumb) breadcrumb.textContent = userName;
  }
  
  // Update all elements with matching pubkey
  document.querySelectorAll(`[data-pubkey="${pubkey}"]`).forEach(el => {
    // Only update if newer
    if (created_at > parseInt(el.dataset.profileCreated_at || "0")) {
      // Update avatar with fallback
      const img = el.querySelector(".user-image");
      if (img) img.src = picture || `https://robohash.org/${pubkey}.png?size=80x80`;
      // Update name
      const nameEl = el.querySelector(".user-name");
      if (nameEl) nameEl.textContent = userName;
      // Mark as updated
      el.dataset.profileCreated_at = created_at;
    }
  });
};