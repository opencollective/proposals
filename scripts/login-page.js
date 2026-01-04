import EmailAuth from "./email-auth.js";
import sendMessage from "./send-message.js";
import { loginWithExtension, loginWithBunker, handleUserEvent } from "./auth-utils.js";
import { checkUserMetadataAndRedirect } from "./check-user-metadata.js";

const id = document.getElementById.bind(document);
const emailAuth = new EmailAuth();

// Check if user is already logged in and redirect back
if(localStorage.getItem("userInfo")) {
  history.back();
}

// Listen for auth errors from email-auth.js
window.addEventListener('authError', (event) => {
  setLoading(verifyBtn, false);
  showMessage(event.detail, "error", verifyFormContainer.querySelector(".form"));
  if (codeInput.value.length === 6) {
    verifyBtn.disabled = false;
  }
});

// Email authentication
const emailFormContainer = id("email-form"),
  emailForm = emailFormContainer.querySelector("form"),
  verifyFormContainer = id("verify-form"),
  verifyCodeToggle = id("verify-code-toggle"),
  emailInput = id("email-input"),
  codeInput = id("code-input"),
  otpInputs = document.querySelectorAll(".otp-input"),
  sendCodeBtn = id("send-code-btn"),
  verifyBtn = id("verify-btn"),
  resetBtn = id("reset-btn"),
  sentEmail = id("sent-email");

// Other login methods
const advancedToggle = id("advanced-toggle"),
  emailToggle = id("email-toggle"),
  otherLoginMethods = id("other-login-methods"),
  extensionBtn = id("extension-btn"),
  bunkerBtn = id("bunker-btn"),
  bunkerInput = id("bunker-input");

// Toggle handlers
advancedToggle.onclick = () => {
  emailFormContainer.classList.add("hidden");
  otherLoginMethods.classList.remove("hidden");
  advancedToggle.classList.add("hidden");
  emailToggle.classList.remove("hidden");
  hideMessage();
};

emailToggle.onclick = () => {
  otherLoginMethods.classList.add("hidden");
  emailFormContainer.classList.remove("hidden");
  emailToggle.classList.add("hidden");
  advancedToggle.classList.remove("hidden");
  bunkerInput.value = "";
  hideMessage();
};

// Utility functions
const showMessage = (text, type = "error", container) => {
    const messageEl = container.querySelector(".message");
    if (!messageEl) return;
    messageEl.classList.remove("hidden", "error", "success");
    messageEl.classList.add(type);
    const icon = type === "success" ? "success" : "error";
    messageEl.innerHTML = `<img src="images/${icon}.svg" class="icon"><span>${text}</span>`;
  },
  hideMessage = () => {
    document.querySelectorAll(".message").forEach(el => {
      el.classList.add("hidden");
      el.innerHTML = "";
    });
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
      if (button === sendCodeBtn) text.textContent = "Sending...";
      else if (button === verifyBtn) text.textContent = "Verifying...";
      else if (button === bunkerBtn) text.textContent = "Connecting...";
      else if (button === extensionBtn) text.textContent = "Connecting...";
      button.disabled = true;
    } else {
      spinner.classList.add("hidden");
      if (button === sendCodeBtn) text.textContent = "Send a one-time connection code";
      else if (button === verifyBtn) {
        text.textContent = "Sign in";
        button.disabled = codeInput.value.length !== 6;
      } else if (button === bunkerBtn) {
        text.textContent = "Connect with Bunker";
        button.disabled = false;
      } else if (button === extensionBtn) {
        text.textContent = "Connect with Nostr extension";
        button.disabled = false;
      } else {
        button.disabled = false;
      }
    }
  };

// Email authentication handlers
// Send code
let countdownInterval;

// Email validation
emailInput.oninput = () => {
  emailInput.classList.remove("error");
  hideMessage();
};

emailForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailInput.value.trim())) {
    emailInput.classList.add("error");
    showMessage("That email doesn't look right. Check for typos, like missing \"@\" or spaces.", "error", emailForm);
    return;
  }
  
  hideMessage();
  emailInput.classList.remove("error");
  setLoading(sendCodeBtn, true);

  try {
    await emailAuth.requestCode(emailInput.value);
    sentEmail.textContent = `(${emailInput.value})`;
    emailFormContainer.classList.add("hidden");
    advancedToggle.classList.add("hidden");
    verifyFormContainer.classList.remove("hidden");
    verifyCodeToggle.classList.remove("hidden");
    startCountdown();
    setTimeout(() => otpInputs[0].focus(), 100);
  } catch (err) {
    emailInput.classList.add("error");
    showMessage(err.message, "error", emailForm);
  } finally {
    setLoading(sendCodeBtn, false);
  }
};

// Verify code
verifyBtn.onclick = async () => {
  hideMessage();
  otpInputs.forEach(input => input.classList.remove("error"));
  setLoading(verifyBtn, true);

  try {
    const pubkey = await emailAuth.verifyCode(codeInput.value);
    sendMessage(JSON.stringify(["REQ", `sub-${pubkey}`, { kinds: [0], authors: [pubkey] }]), handleUserEvent);
    clearInterval(countdownInterval);
    setLoading(verifyBtn, false);
    checkUserMetadataAndRedirect(pubkey);
  } catch (err) {
    const popup = window.open('', 'bunkerAuth');
    if (popup) popup.close();
    otpInputs.forEach(input => input.classList.add("error"));
    showMessage(err.message, "error", verifyFormContainer.querySelector(".form"));
  } finally {
    setLoading(verifyBtn, false);
    setTimeout(() => {
      if (codeInput.value.length === 6) {
        verifyBtn.disabled = false;
      }
    }, 50);
  }
};

// Input validation
otpInputs.forEach((input, index) => {
  input.oninput = (e) => {
    input.value = input.value.replace(/\D/g, "");
    input.classList.remove("error");
    hideMessage();
    if (input.value && index < 5) otpInputs[index + 1].focus();
    updateCodeInput();
  };
  input.onkeydown = (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  };
  input.onpaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    paste.split("").forEach((char, i) => {
      if (otpInputs[i]) otpInputs[i].value = char;
    });
    updateCodeInput();
    if (paste.length === 6) otpInputs[5].focus();
  };
});

function updateCodeInput() {
  codeInput.value = Array.from(otpInputs).map(input => input.value).join("");
  verifyBtn.disabled = codeInput.value.length !== 6;
}

// Reset
resetBtn.onclick = () => {
  clearInterval(countdownInterval);
  verifyFormContainer.classList.add("hidden");
  verifyCodeToggle.classList.add("hidden");
  emailFormContainer.classList.remove("hidden");
  advancedToggle.classList.remove("hidden");
  emailInput.value = "";
  codeInput.value = "";
  otpInputs.forEach(input => input.value = "");
  hideMessage();
};

// Countdown and resend
const countdownEl = id("countdown"),
  resendBtn = verifyFormContainer.querySelector(".resend-btn");

function startCountdown() {
  let seconds = 50;
  countdownEl.textContent = `${seconds} seconds`;
  countdownEl.parentElement.classList.remove("hidden");
  resendBtn.classList.add("hidden");
  
  countdownInterval = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      countdownEl.textContent = `${seconds} seconds`;
    } else {
      clearInterval(countdownInterval);
      countdownEl.parentElement.classList.add("hidden");
      resendBtn.classList.remove("hidden");
    }
  }, 1000);
}

resendBtn.onclick = async () => {
  hideMessage();
  try {
    await emailAuth.requestCode(emailInput.value);
    startCountdown();
  } catch (err) {
    showMessage(err.message, "error", verifyFormContainer.querySelector(".form"));
  }
};

// Other login methods
extensionBtn.onclick = async () => {
  hideMessage();
  setLoading(extensionBtn, true);
  try {
    await loginWithExtension(handleUserEvent);
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    checkUserMetadataAndRedirect(userInfo.pubkey);
  } catch (err) {
    showMessage(
      "We can't connect to your extension right now. Try again or use another method.",
      "error",
      extensionBtn.parentElement
    );
  } finally {
    setLoading(extensionBtn, false);
  }
};

bunkerInput.oninput = () => {
  bunkerInput.classList.remove("error");
  hideMessage();
};

bunkerBtn.onclick = async () => {
  const bunkerUrl = bunkerInput.value.trim();
  if (!bunkerUrl) {
    bunkerInput.classList.add("error");
    showMessage("Please enter a Bunker URL", "error", bunkerBtn.parentElement);
    return;
  }
  
  hideMessage();
  bunkerInput.classList.remove("error");
  setLoading(bunkerBtn, true);
  
  try {
    await loginWithBunker(bunkerUrl, handleUserEvent);
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    checkUserMetadataAndRedirect(userInfo.pubkey);
  } catch (err) {
    bunkerInput.classList.add("error");
    showMessage(err.message || "We were unable to connect. Check for typos or spaces.", "error", bunkerBtn.parentElement);
  } finally {
    setLoading(bunkerBtn, false);
  }
}
