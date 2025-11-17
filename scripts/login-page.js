import EmailAuth from "./email-auth.js";
import sendMessage from "./send-message.js";
import { loginWithExtension, loginWithBunker, handleUserEvent } from "./auth-utils.js";

const id = document.getElementById.bind(document);
const emailAuth = new EmailAuth();

// Check if user is already logged in and redirect back
if(localStorage.getItem("userInfo")) {
  history.back();
}

// Listen for auth errors from email-auth.js
window.addEventListener('authError', (event) => {
  setLoading(verifyBtn, false);
  showMessage(event.detail);
  if (codeInput.value.length === 6) {
    verifyBtn.disabled = false;
  }
});

// Email authentication
const emailForm = id("email-form"),
  verifyForm = id("verify-form"),
  emailInput = id("email-input"),
  codeInput = id("code-input"),
  sendCodeBtn = id("send-code-btn"),
  verifyBtn = id("verify-btn"),
  resetBtn = id("reset-btn"),
  sentEmail = id("sent-email"),
  messageDisplay = id("message-display");

// Other login methods
const advancedToggle = id("advanced-toggle"),
  otherLoginMethods = id("other-login-methods"),
  nostrLoginBtn = id("nostr-login-btn"),
  bunkerLoginBtn = id("bunker-login-btn"),
  nsecInput = id("nsec-input"),
  createAccInfo = id("create-acc-info");

// Advanced toggle handler
advancedToggle.onclick = () => {
  otherLoginMethods.classList.toggle("hidden");
  advancedToggle.classList.toggle("expanded");
  const span = advancedToggle.querySelector("span");
  span.textContent = otherLoginMethods.classList.contains("hidden") ? "Advanced" : "Hide Advanced";
};

// Utility functions
const showMessage = (text, type = "error") => {
    messageDisplay.textContent = text;
    messageDisplay.className = `message ${type}`;
    messageDisplay.classList.remove("hidden");
  },
  hideMessage = () => {
    messageDisplay.classList.add("hidden");
  },
  goBack = () => {
    setTimeout(() => history.back(), 1500);
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
      text.textContent = button === sendCodeBtn ? "Sending..." : "Verifying...";
      button.disabled = true;
    } else {
      spinner.classList.add("hidden");
      text.textContent = button === sendCodeBtn ? "Send Verification Code" : "Verify Code";
      // For verify button, check if code is valid before enabling
      if (button === verifyBtn) {
        button.disabled = codeInput.value.length !== 6;
      } else {
        button.disabled = false;
      }
    }
  };

// Email authentication handlers
// Send code
emailForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!nsecInput.classList.contains("hidden")) {
    nsecInput.classList.add("hidden");
    bunkerLoginBtn.classList.remove("active");
  }
  hideMessage();
  setLoading(sendCodeBtn, true);

  try {
    const message = await emailAuth.requestCode(emailInput.value);
    sentEmail.textContent = emailInput.value;
    emailForm.classList.add("hidden");
    verifyForm.classList.remove("hidden");
    showMessage(
      "Verification code sent to your email by Openbunker. Please check your inbox and enter the code to continue." ||
        message, 
      "success"
    );
  } catch (err) {
    showMessage(err.message);
  } finally {
    setLoading(sendCodeBtn, false);
  }
};

// Verify code
verifyForm.onsubmit = async (e) => {
  e.preventDefault();
  hideMessage();
  setLoading(verifyBtn, true);

  try {
    const pubkey = await emailAuth.verifyCode(codeInput.value);
    sendMessage(JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]), handleUserEvent);
    showMessage("Authentication successful! Redirecting...", "success");
    goBack();
  } catch (err) {
    const popup = window.open('', 'bunkerAuth');
    if (popup) popup.close();
    showMessage(err.message);
  } finally {
    setLoading(verifyBtn, false);
    // Ensure button is enabled after error if code is 6 digits
    setTimeout(() => {
      if (codeInput.value.length === 6) {
        verifyBtn.disabled = false;
      }
    }, 50);
  }
};

// Input validation
codeInput.oninput = () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
  verifyBtn.disabled = codeInput.value.length !== 6;
};

// Reset
resetBtn.onclick = () => {
  emailForm.classList.remove("hidden");
  verifyForm.classList.add("hidden");
  emailInput.value = "";
  codeInput.value = "";
  hideMessage();
};

// Other login methods
nostrLoginBtn.onclick = async () => {
  if (!nsecInput.classList.contains("hidden")) {
    nsecInput.classList.add("hidden");
    bunkerLoginBtn.classList.remove("active");
  }

  try {
    await loginWithExtension(handleUserEvent);
    showMessage("Login successful! Redirecting...", "success");
    goBack();
  } catch (err) {
    showMessage(
      `The extension was closed before permission was granted.
      Please try again or choose another login method.`
    );
  }
};

bunkerLoginBtn.onclick = () => {
  if (nsecInput.classList.contains("hidden")) {
    nsecInput.classList.remove("hidden");
    createAccInfo.classList.add("hidden");
    bunkerLoginBtn.classList.add("active");
    hideMessage();
  } else {
    handleBunkerLogin();
  }
};


async function handleBunkerLogin() {
  try {
    await loginWithBunker(nsecInput.value.trim(), handleUserEvent);
    showMessage("Login successful! Redirecting...", "success");
    goBack();
  } catch (err) {
    showMessage(err.message || "Invalid nsec bunker url");
  }
}
