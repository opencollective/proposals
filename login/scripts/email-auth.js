import * as NostrTools from "./nostr-tools.bundle.mjs";

// Global auth popup reference for cleanup
let globalAuthPopup = null;

// Email-based authentication using bunker (NIP-46)
class EmailAuth {
  constructor() {
    this.bunkerToken = ""; // Bunker connection token
    this.email = ""; // User email
  }

  // Request verification code via email
  async requestCode(email) {
    // Call openbunker API to send code
    const response = await fetch(
      "https://openbunker.opencollective.xyz/api/openbunker-unauthenticated-token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: "Proposal", scope: "proposal" }),
      },
    );

    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Failed to send code");

    // Store bunker token and email for verification step
    this.bunkerToken = data.bunkerConnectionToken;
    this.email = email;
    return data.message;
  }

  // Verify code and create bunker signer
  async verifyCode(code) {
    if (!this.bunkerToken) throw new Error("No bunker token available");

    globalAuthPopup?.close(); // Close any existing popup

    // Add verification code to bunker token
    const url = new URL(this.bunkerToken);
    url.searchParams.set("secret", code);

    // Generate local private key and parse bunker connection
    const localPrivKey = NostrTools.generateSecretKey(),
      bunkerPointer = await NostrTools.parseBunkerInput(url.toString());

    // Create bunker signer with auth popup handler
    const signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, {
      pool: new NostrTools.SimplePool(),
      onauth: (authUrl) =>
        new Promise((resolve, reject) => {
          // Open auth popup
          globalAuthPopup = window.open(
            authUrl,
            "bunkerAuth",
            "width=500,height=600",
          );

          // Check popup status every 200ms
          const check = setInterval(() => {
            try {
              // Check for invalid code error page
              if (
                globalAuthPopup?.location?.href.includes(
                  "undefined/openbunker-login-popup",
                )
              ) {
                globalAuthPopup.close();
                clearInterval(check);
                // Dispatch error event for UI
                window.dispatchEvent(
                  new CustomEvent("authError", {
                    detail: "That code is incorrect. Try again or start over.",
                  }),
                );
                reject(new Error("Invalid verification code"));
                return;
              }
            } catch (e) {} // Cross-origin access error is expected

            // Resolve when popup closes
            if (globalAuthPopup?.closed) {
              clearInterval(check);
              resolve();
            }
          }, 200);

          // Timeout after 10 seconds
          setTimeout(() => {
            if (globalAuthPopup && !globalAuthPopup.closed) {
              globalAuthPopup.close();
              clearInterval(check);
              reject(new Error("Authentication timeout"));
            }
          }, 10000);
        }),
    });

    try {
      // Connect to bunker and get pubkey
      await signer.connect();
      const pubkey = await signer.getPublicKey();

      // Save bunker auth data
      localStorage.setItem(
        "bunkerAuth",
        JSON.stringify({
          bp: signer.bp,
          secretKey: NostrTools.bytesToHex(localPrivKey),
          conversationKey: NostrTools.bytesToHex(signer.conversationKey),
        }),
      );

      // Save user info with email
      localStorage.setItem(
        "userInfo",
        JSON.stringify({
          pubkey,
          npub: NostrTools.nip19.npubEncode(pubkey),
          created_at: 0,
          bunkerSigner: true,
          email: this.email,
        }),
      );

      // Store signer globally
      window.bunkerSigner = signer;
      return pubkey;
    } catch (error) {
      globalAuthPopup?.close();
      throw new Error("Invalid verification code");
    }
  }
}

// Cleanup popup on page unload
window.addEventListener("beforeunload", () => globalAuthPopup?.close());

export default EmailAuth;

// Flow: requestCode (send email) → verifyCode (create bunker signer with popup auth) → connect & get pubkey → save to localStorage
