import sendMessage from "./send-message.js";

export function checkUserMetadataAndRedirect(pubkey) {
  let metadata,
    eoseCount = 0,
    redirected = false;
  const subId = `meta-${Date.now()}`;

  const redirect = () => {
    if (redirected) return;
    redirected = true;
    sendMessage(JSON.stringify(["CLOSE", subId]), () => {});
    
    if (metadata) {
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
      window.location.href = "/user-metadata.html";
    }
  };

  sendMessage(
    JSON.stringify(["REQ", subId, { kinds: [0], authors: [pubkey], limit: 1 }]),
    ([type, id, event]) => {
      if (id !== subId || redirected) return;
      if (type === "EVENT" && event?.kind === 0) {
        const c = JSON.parse(event.content);
        if (c.displayName || c.display_name || c.name) metadata = c;
      }
      if (type === "EOSE" && ++eoseCount >= (window.relays?.length || 1))
        redirect();
    },
  );

  setTimeout(() => !redirected && redirect(), 5000);
}
