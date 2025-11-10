import sendMessage from "./send-message.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

// Shared authentication utilities
export const loginWithExtension = async (handleUserEvent) => {
  if (!window.nostr) throw new Error("Nostr extension not found");
  
  const pubkey = await window.nostr.getPublicKey();
  if (!activeRelays.size) throw new Error("No relays online. Try later.");
  
  localStorage.setItem("userInfo", JSON.stringify({
    pubkey,
    npub: NostrTools.nip19.npubEncode(pubkey),
    created_at: 0
  }));
  
  sendMessage(JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]), handleUserEvent);
  return pubkey;
};

export const createBunkerSigner = async (bunkerInput) => {
  const localPrivKey = NostrTools.generateSecretKey(),
    bunkerPointer = await NostrTools.parseBunkerInput(bunkerInput);

  const signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, {
    pool: new NostrTools.SimplePool(),
    onauth: (authUrl) => new Promise(resolve => {
      const popup = window.open(authUrl, "bunkerAuth", "width=500,height=600");
      const check = setInterval(() => {
        if (popup?.closed) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    })
  });

  await signer.connect();
  const pubkey = await signer.getPublicKey();

  localStorage.setItem("bunkerAuth", JSON.stringify({
    bp: signer.bp,
    secretKey: NostrTools.bytesToHex(localPrivKey),
    conversationKey: NostrTools.bytesToHex(signer.conversationKey)
  }));

  window.bunkerSigner = signer;
  return pubkey;
};

export const loginWithBunker = async (bunkerInput, handleUserEvent) => {
  const pubkey = await createBunkerSigner(bunkerInput);
  if (!activeRelays.size) throw new Error("No relays online. Try later.");
  
  localStorage.setItem("userInfo", JSON.stringify({
    pubkey,
    npub: NostrTools.nip19.npubEncode(pubkey),
    created_at: 0,
    bunkerSigner: true
  }));
  
  sendMessage(JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]), handleUserEvent);
  return pubkey;
};

export const handleUserEvent = ([type, , event]) => {
  if (type !== "EVENT") return;

  const { kind, pubkey, created_at, content } = event,
    userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (kind === 0 && pubkey === userInfo?.pubkey && created_at > (userInfo?.created_at || 0)) {
    try {
      const profileData = JSON.parse(content);
      Object.assign(userInfo, profileData, { created_at });
      localStorage.setItem("userInfo", JSON.stringify(userInfo));
    } catch (err) {
      console.error("Error parsing user profile:", err);
    }
  }
};

export const handleLogin = async (onSuccess) => {
  if (window.nostr) {
    try {
      await loginWithExtension((data) => {
        handleUserEvent(data);
      });
      onSuccess?.();
    } catch (err) {
      const tryOtherLogin = confirm(
        "The extension was closed before permission was granted. Please try again. Or would you like to try other login methods?"
      );
      if (tryOtherLogin) {
        window.location.href = "/login";
      }
    }
  } else {
    window.location.href = "/login";
  }
};