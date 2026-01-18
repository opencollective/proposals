import sendMessage from "./send-message.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";

const getFromLocalStorage = (key) => JSON.parse(localStorage.getItem(key)) || null,
  userInfo = getFromLocalStorage("userInfo");

// Save referrer on page load if not already saved
if (!localStorage.getItem("returnUrl") && document.referrer) {
  const referrerUrl = new URL(document.referrer);
  if (referrerUrl.hostname === window.location.hostname && !referrerUrl.pathname.includes("login")) {
    localStorage.setItem("returnUrl", document.referrer);
  }
}

// Check if user already has a name or chose to remain anonymous, redirect if they do
if (userInfo?.name || userInfo?.displayName || userInfo?.display_name || userInfo?.anonymous) {
  const returnUrl = localStorage.getItem("returnUrl");
  localStorage.removeItem("returnUrl");
  
  if (returnUrl && new URL(returnUrl, window.location.origin).hostname === window.location.hostname) {
    window.location.href = returnUrl;
  } else if (document.referrer && new URL(document.referrer).hostname === window.location.hostname) {
    window.history.back();
  } else {
    window.location.href = "/";
  }
}

const id = document.getElementById.bind(document);

const nameInput = id("name-input"),
  saveBtn = id("save-btn"),
  skipBtn = id("skip-btn"),
  bunkerAuth = getFromLocalStorage("bunkerAuth");

// Utility functions
const showMessage = (text, type = "error") => {
    const messageEl = document.querySelector(".message");
    if (!messageEl) return;
    messageEl.classList.remove("hidden", "error", "success");
    messageEl.classList.add(type);
    const icon = type === "success" ? "success" : "error";
    messageEl.innerHTML = `<img src="./images/${icon}.svg" class="icon"><span>${text}</span>`;
  },
  hideMessage = () => {
    const messageEl = document.querySelector(".message");
    if (messageEl) {
      messageEl.classList.add("hidden");
      messageEl.innerHTML = "";
    }
  },
  setLoading = (button, loading) => {
    const spinner = button.querySelector(".spinner");
    const text = button.querySelector(".btn-text");
    
    if (loading) {
      spinner.innerHTML = 
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#99cfff" d="M21.86 5.17a11.9 11.9 0 0 1 0 13.66l-3.11-3.11a7.7 7.7 0 0 0 0-7.46l3.11-3.11Z"/>
          <path fill="#1f87ff" d="m18.83 2.14-3.11 3.11a7.7 7.7 0 1 0 0 13.5l3.11 3.11a12 12 0 1 1 0-19.72"/>
        </svg>`;
      spinner.classList.remove("hidden");
      text.textContent = "Saving...";
      button.disabled = true;
    } else {
      spinner.classList.add("hidden");
      text.textContent = "Save and continue";
      button.disabled = false;
    }
  };

// Input change handler
nameInput.oninput = () => {
  nameInput.classList.remove("error");
  hideMessage();
};

// Sign event using bunker
async function signWithBunker(event) {
  const pool = new NostrTools.SimplePool(),
    localPrivKey = NostrTools.hexToBytes(bunkerAuth.secretKey),
    conversationKey = NostrTools.hexToBytes(bunkerAuth.conversationKey),
    signer = new NostrTools.BunkerSigner(localPrivKey, bunkerAuth.bp, { pool });
  
  signer.conversationKey = conversationKey;
  signer.cachedPubKey = bunkerAuth.bp.pubkey;
  signer.isOpen = true;
  signer.waitingForAuth = {};
  
  return await signer.signEvent(event);
}

// Save button handler
saveBtn.onclick = async (e) => {
  e.preventDefault();
  
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.classList.add("error");
    showMessage("Please enter your name", "error");
    return;
  }
  
  hideMessage();
  nameInput.classList.remove("error");
  setLoading(saveBtn, true);
  
  try {
    if (!window.nostr && !userInfo?.bunkerSigner) {
      throw new Error("Please connect your nostr profile first");
    }

    const timestamp = Math.floor(Date.now() / 1000),
      metadata = { 
        name, 
        displayName: name, 
        display_name: name,
        npub: userInfo.npub,
        pubkey: userInfo.pubkey
      },
      event = {
        kind: 0,
        content: JSON.stringify(metadata),
        tags: [],
        created_at: timestamp,
      };

    const signed = !userInfo?.bunkerSigner
      ? await nostr.signEvent(event)
      : await signWithBunker(event);

    sendMessage(JSON.stringify(["EVENT", signed]), () => {
      // Update userInfo immediately with the new name
      const updatedUserInfo = { ...userInfo, name, displayName: name, display_name: name, created_at: timestamp };
      localStorage.setItem("userInfo", JSON.stringify(updatedUserInfo));
      
      setLoading(saveBtn, false);
      showMessage("Congratulations! Your name has been saved. 👋🏽", "success");
      
      // Dispatch metadata check complete event
      window.dispatchEvent(new CustomEvent("metadataCheckComplete"));
      
      setTimeout(() => {
        const returnUrl = localStorage.getItem("returnUrl");
        localStorage.removeItem("returnUrl");
        
        if (returnUrl && new URL(returnUrl, window.location.origin).hostname === window.location.hostname) {
          window.location.href = returnUrl;
        } else if (document.referrer) {
          const referrerUrl = new URL(document.referrer);
          if (referrerUrl.hostname === window.location.hostname) {
            if (referrerUrl.pathname === "/login" || referrerUrl.pathname === "/login.html") {
              window.location.href = "/";
            } else {
              window.history.back();
            }
          } else {
            window.location.href = "/";
          }
        } else {
          window.location.href = "/";
        }
      }, 2000);
    });
  } catch (err) {
    nameInput.classList.add("error");
    showMessage(err.message || "Failed to save your name. Please try again.", "error");
    setLoading(saveBtn, false);
  }
};

// Skip button handler
skipBtn.onclick = () => {
  // Mark user as choosing to remain anonymous
  const currentUserInfo = getFromLocalStorage("userInfo");
  if (currentUserInfo) {
    localStorage.setItem("userInfo", JSON.stringify({ ...currentUserInfo, anonymous: true }));
  }
  
  // Dispatch metadata check complete event
  window.dispatchEvent(new CustomEvent("metadataCheckComplete"));
  
  const returnUrl = localStorage.getItem("returnUrl");
  localStorage.removeItem("returnUrl");
  
  if (returnUrl && new URL(returnUrl, window.location.origin).hostname === window.location.hostname) {
    window.location.href = returnUrl;
  } else if (document.referrer) {
    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.hostname === window.location.hostname) {
      if (referrerUrl.pathname === "/login" || referrerUrl.pathname === "/login.html") {
        window.location.href = "/";
      } else {
        window.history.back();
      }
    } else {
      window.location.href = "/";
    }
  } else {
    window.location.href = "/";
  }
};
