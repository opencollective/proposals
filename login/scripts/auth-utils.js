import sendMessage from "./send-message.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

// Login with Nostr browser extension (NIP-07)
export const loginWithExtension = async (handleUserEvent) => {
  if (!window.nostr) throw new Error("Nostr extension not found");

  // Get pubkey from extension
  const pubkey = await window.nostr.getPublicKey();
  if (!activeRelays.size) throw new Error("No relays online. Try later.");

  // Save user info to localStorage
  localStorage.setItem(
    "userInfo",
    JSON.stringify({
      pubkey,
      npub: NostrTools.nip19.npubEncode(pubkey),
      created_at: 0,
    }),
  );

  // Fetch user profile (kind 0) from relays
  sendMessage(
    JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]),
    handleUserEvent,
  );
  return pubkey;
};

// Create bunker signer for remote signing (NIP-46)
export const createBunkerSigner = async (bunkerInput) => {
  // Generate local private key and parse bunker connection string
  const localPrivKey = NostrTools.generateSecretKey(),
    bunkerPointer = await NostrTools.parseBunkerInput(bunkerInput);

  // Create bunker signer with auth popup handler
  const signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, {
    pool: new NostrTools.SimplePool(),
    onauth: (authUrl) =>
      new Promise((resolve) => {
        // Open auth popup and wait for user to complete
        const popup = window.open(
          authUrl,
          "bunkerAuth",
          "width=500,height=600",
        );
        const check = setInterval(() => {
          if (popup?.closed) {
            clearInterval(check);
            resolve();
          }
        }, 500);
      }),
  });

  // Connect to bunker and get pubkey
  await signer.connect();
  const pubkey = await signer.getPublicKey();

  // Save bunker auth data to localStorage
  localStorage.setItem(
    "bunkerAuth",
    JSON.stringify({
      bp: signer.bp,
      secretKey: NostrTools.bytesToHex(localPrivKey),
      conversationKey: NostrTools.bytesToHex(signer.conversationKey),
    }),
  );

  // Store signer globally for signing operations
  window.bunkerSigner = signer;
  return pubkey;
};

// Login with bunker (remote signer)
export const loginWithBunker = async (bunkerInput, handleUserEvent) => {
  // Create bunker signer and get pubkey
  const pubkey = await createBunkerSigner(bunkerInput);
  if (!activeRelays.size) throw new Error("No relays online. Try later.");

  // Save user info with bunkerSigner flag
  localStorage.setItem(
    "userInfo",
    JSON.stringify({
      pubkey,
      npub: NostrTools.nip19.npubEncode(pubkey),
      created_at: 0,
      bunkerSigner: true,
    }),
  );

  // Fetch user profile (kind 0) from relays
  sendMessage(
    JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]),
    handleUserEvent,
  );
  return pubkey;
};

// Handle user profile events (kind 0) from relays
export const handleUserEvent = ([type, , event]) => {
  if (type !== "EVENT") return; // Only process EVENT messages

  const { kind, pubkey, created_at, content } = event,
    userInfo = JSON.parse(localStorage.getItem("userInfo"));

  // Update profile if it's newer than cached version
  if (
    kind === 0 &&
    pubkey === userInfo?.pubkey &&
    created_at > (userInfo?.created_at || 0)
  ) {
    try {
      // Parse profile data and replace userInfo completely
      const profileData = JSON.parse(content);
      const bunkerSigner = userInfo.bunkerSigner;
      const anonymous = userInfo.anonymous;
      const newUserInfo = {
        npub: userInfo.npub,
        pubkey,
        created_at,
        ...profileData,
        ...(bunkerSigner && { bunkerSigner }),
        ...(anonymous && { anonymous }),
      };
      localStorage.setItem("userInfo", JSON.stringify(newUserInfo));

      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent("userInfoUpdated"));
    } catch (err) {
      console.error("Error parsing user profile:", err);
    }
  }
};

// Handle login flow: try extension first, fallback to login page
export const handleLogin = async (onSuccess) => {
  if (window.nostr) {
    // Try extension login
    try {
      const pubkey = await loginWithExtension((data) => {
        handleUserEvent(data); // Handle profile event
      });
      
      // Wait for profile to be fetched and check if user has name
      setTimeout(() => {
        const userInfo = JSON.parse(localStorage.getItem("userInfo"));
        if (!userInfo?.name && !userInfo?.displayName && !userInfo?.display_name && !userInfo?.anonymous) {
          const currentPath = window.location.pathname;
          if (currentPath !== "/login.html" && currentPath !== "/login" && currentPath !== "/login/user-metadata.html" && currentPath !== "/login/user-metadata") {
            localStorage.setItem("returnUrl", window.location.href);
          }
          window.location.href = "/login/user-metadata";
        } else {
          window.dispatchEvent(new CustomEvent("metadataCheckComplete"));
          onSuccess?.(); // Call success callback
        }
      }, 2000);
    } catch (err) {
      // Extension permission denied - offer alternative
      const tryOtherLogin = confirm(
        "The extension was closed before permission was granted. Please try again. Or would you like to try other login methods?",
      );
      if (tryOtherLogin) {
        window.location.href = "/login";
      }
    }
  } else {
    // No extension - redirect to login page
    window.location.href = "/login";
  }
};

// Flow: handleLogin → loginWithExtension/loginWithBunker (get pubkey & save) → sendMessage (fetch profile) → handleUserEvent (update & dispatch event)
