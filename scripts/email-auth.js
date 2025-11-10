import * as NostrTools from "./nostr-tools.bundle.mjs";

let globalAuthPopup = null;

class EmailAuth {
  constructor() {
    this.bunkerToken = "";
    this.email = "";
  }

  async requestCode(email) {
    const response = await fetch("https://openbunker.opencollective.xyz/api/openbunker-unauthenticated-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: "Proposal", scope: "proposal" })
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Failed to send code");
    
    this.bunkerToken = data.bunkerConnectionToken;
    this.email = email;
    return data.message;
  }

  async verifyCode(code) {
    if (!this.bunkerToken) throw new Error("No bunker token available");

    globalAuthPopup?.close();

    const url = new URL(this.bunkerToken);
    url.searchParams.set("secret", code);
    
    const localPrivKey = NostrTools.generateSecretKey(),
      bunkerPointer = await NostrTools.parseBunkerInput(url.toString());
    
    const signer = new NostrTools.BunkerSigner(localPrivKey, bunkerPointer, {
      pool: new NostrTools.SimplePool(),
      onauth: (authUrl) => new Promise((resolve, reject) => {
        globalAuthPopup = window.open(authUrl, "bunkerAuth", "width=500,height=600");
        
        const check = setInterval(() => {
          try {
            if (globalAuthPopup?.location?.href.includes('undefined/openbunker-login-popup')) {
              globalAuthPopup.close();
              clearInterval(check);
              // Dispatch custom event for UI handling
              window.dispatchEvent(new CustomEvent('authError', { detail: 'That code is incorrect. Try again or start over.' }));
              reject(new Error("Invalid verification code"));
              return;
            }
          } catch (e) {}
          
          if (globalAuthPopup?.closed) {
            clearInterval(check);
            resolve();
          }
        }, 200);
        
        setTimeout(() => {
          if (globalAuthPopup && !globalAuthPopup.closed) {
            globalAuthPopup.close();
            clearInterval(check);
            reject(new Error("Authentication timeout"));
          }
        }, 10000);
      })
    });

    try {
      await signer.connect();
      const pubkey = await signer.getPublicKey();
      
      localStorage.setItem("bunkerAuth", JSON.stringify({
        bp: signer.bp,
        secretKey: NostrTools.bytesToHex(localPrivKey),
        conversationKey: NostrTools.bytesToHex(signer.conversationKey)
      }));

      localStorage.setItem("userInfo", JSON.stringify({
        pubkey,
        npub: NostrTools.nip19.npubEncode(pubkey),
        created_at: 0,
        bunkerSigner: true,
        email: this.email
      }));

      window.bunkerSigner = signer;
      return pubkey;
    } catch (error) {
      globalAuthPopup?.close();
      throw new Error("Invalid verification code");
    }
  }
}

window.addEventListener('beforeunload', () => globalAuthPopup?.close());

export default EmailAuth;