import sendMessage from "./send-message.js";

export function checkUserMetadataAndRedirect(pubkey) {
  let latestEvent = null,
    eoseCount = 0,
    redirected = false;
  const subId = `meta-${Date.now()}`;

  const redirect = () => {
    if (redirected) return;
    redirected = true;
    sendMessage(JSON.stringify(["CLOSE", subId]), () => {});
    
    // Check if user chose to remain anonymous
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    if (userInfo?.anonymous) {
      const returnUrl = window.location.pathname.includes("login") &&
        document.referrer &&
        !document.referrer.includes("login")
        ? document.referrer
        : "/";
      window.location.href = returnUrl;
      return;
    }
    
    // Check if latest event has name fields
    let hasName = false;
    if (latestEvent) {
      try {
        const c = JSON.parse(latestEvent.content);
        hasName = !!(c.displayName || c.display_name || c.name);
      } catch {}
    }
    
    if (hasName) {
      const returnUrl = window.location.pathname.includes("login") &&
        document.referrer &&
        !document.referrer.includes("login")
        ? document.referrer
        : "/";
      window.location.href = returnUrl;
    } else {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login.html" && currentPath !== "/login") {
        localStorage.setItem("returnUrl", currentPath);
      } else if (document.referrer && !document.referrer.includes("login")) {
        localStorage.setItem("returnUrl", document.referrer);
      }
      window.location.href = "/login/user-metadata";
    }
  };

  sendMessage(
    JSON.stringify(["REQ", subId, { kinds: [0], authors: [pubkey], limit: 1 }]),
    ([type, id, event]) => {
      if (id !== subId || redirected) return;
      if (type === "EVENT" && event?.kind === 0) {
        // Keep only the latest event
        if (!latestEvent || event.created_at > latestEvent.created_at) {
          latestEvent = event;
        }
      }
      if (type === "EOSE" && ++eoseCount >= (window.relays?.length || 1))
        redirect();
    },
  );

  setTimeout(() => !redirected && redirect(), 5000);
}
