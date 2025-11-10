export const updateProfile = (pubkey) => {
  const profile = window.profileCache.get(pubkey);
  if (!profile) return;
  const { content, created_at } = profile,
    { picture, display_name, displayName, name } = JSON.parse(content),
    userName = display_name || displayName || name || "Anonymous";
  
  // Update breadcrumb for profile pages
  const pathname = window.location.pathname.slice(1);
  if (pathname.startsWith("npub")) {
    const breadcrumb = document.querySelector(".breadcrumb-item.current");
    if (breadcrumb) breadcrumb.textContent = userName;
  }
  
  document.querySelectorAll(`[data-pubkey="${pubkey}"]`).forEach(el => {
    if (created_at > parseInt(el.dataset.profileCreated_at || "0")) {
      if (picture) {
        const img = el.querySelector(".user-image");
        if (img) {
          img.onerror = () => img.src = `https://robohash.org/${pubkey}.png?size=25x25`;
          img.src = picture;
        }
      }
      const nameEl = el.querySelector(".user-name");
      if (nameEl) nameEl.textContent = userName;
      el.dataset.profileCreated_at = created_at;
    }
  });
};