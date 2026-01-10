// Set button loading state (show spinner, disable button)
export const setButtonLoading = (button, loading) => {
  if (loading) {
    button.disabled = true;
    button.dataset.originalHTML = button.innerHTML;
    button.innerHTML = `<div class="flex justify-center items-center">
        <svg class="spinner btn-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#99cfff" d="M21.86 5.17a11.9 11.9 0 0 1 0 13.66l-3.11-3.11a7.7 7.7 0 0 0 0-7.46l3.11-3.11Z"/>
          <path fill="#1f87ff" d="m18.83 2.14-3.11 3.11a7.7 7.7 0 1 0 0 13.5l3.11 3.11a12 12 0 1 1 0-19.72"/>
        </svg>
      </div>`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHTML || button.innerHTML;
  }
};

// Format timestamp to relative date
export const formatDate = (t) => {
    if (!t) return "";
    const date = new Date(t * 1000),
      days = Math.floor((Date.now() - date.getTime()) / 86400000),
      months = Math.floor(days / 30);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  },
  // Format timestamp to full date with time
  formatFullDate = (t) =>
    t
      ? new Date(t * 1000).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "",
  // Setup date formatting with hover to show full date
  setupDateFormatting = (container = document) => {
    container.querySelectorAll("[data-timestamp]").forEach((el) => {
      if (el.dataset.dateFormatted) return;
      const ts = el.dataset.timestamp;
      el.textContent = formatDate(ts);
      el.dataset.dateFormatted = "true";
      el.addEventListener(
        "mouseenter",
        () => (el.textContent = formatFullDate(ts)),
      );
      el.addEventListener(
        "mouseleave",
        () => (el.textContent = formatDate(ts)),
      );
    });
  },
  // Get and parse JSON from localStorage
  getFromLocalStorage = (key) => JSON.parse(localStorage.getItem(key)) || null,
  // Get tag value by tag name
  getTag = (tags, tagName) => tags?.find((t) => t[0] === tagName)?.[1],
  // Generate unique ID from event
  generateUId = (event) => {
    const { kind, pubkey, tags } = event,
      dTag = getTag(tags, "d");
    return dTag ? `${kind}:${pubkey}:${dTag}` : null;
  },
  linkifyNostr = (text) => {
    return text.replace(/nostr:([a-z0-9]+)/gi, (_, eventId) => {
      try {
        const { type, data } = NostrTools.nip19.decode(eventId),
          label =
            type === "note" ? "Note" : type === "npub" ? "Profile" : "Event",
          href =
            type === "note"
              ? `https://njump.me/${data}`
              : type === "npub"
                ? `/${eventId}`
                : data?.kind === 39700 || data?.kind === 39701
                  ? `/${eventId}`
                  : `https://njump.me/${eventId}`;
        return `<a href="${href}">${label}</a>`;
      } catch {
        return `nostr:${eventId}`;
      }
    });
  },
  normalizeReaction = (content) => {
    const trimmed = content.trim();
    if (/^\p{Emoji}$/u.test(trimmed)) return trimmed;
    const map = {
      "+": "❤️",
      heart: "❤️",
      love: "❤️",
      "-": "👎",
      dislike: "👎",
      like: "👍",
      fire: "🔥",
    };
    return map[trimmed.toLowerCase()] || trimmed;
  },
  updateCreateButton = () => {
    const userInfo = getFromLocalStorage("userInfo");
    if (!userInfo) return;

    const proposalBtn = document.querySelector(".proposal-btn-lg-container");
    if (!proposalBtn) return;

    proposalBtn.classList.remove("hidden");
    proposalBtn.setAttribute("data-pubkey", userInfo.pubkey);

    proposalBtn.innerHTML = `
      <a href="/create" class="proposal-btn-lg">
        <div class="proposal-btn-lg-content">
          <img
            class="user-name" 
            src="${userInfo.picture || "https://robohash.org/" + userInfo.pubkey + ".png?size=25x25"}"
            alt="avatar"
          >
          <div>Make a new proposal</div>
        </div>
        <div class="proposal-btn-lg-icon">+</div>
      </a>
    `;
  },
  setupScrollObserver = (container, selector, callback) => {
    const cards = container?.querySelectorAll(selector);
    if (!cards || cards.length < 10) return;

    const target = cards[cards.length - 10];
    if (target.dataset.observed) return;

    target.dataset.observed = "true";
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(target);
  };

// Show selected group in UI
export const showSelectedGroup = () => {
  const group = getFromLocalStorage("group");
  if (!group) location.href = "/groups";

  const groupEl = document.getElementById("selected-group");
  if (!groupEl || !generateUId(group)) return;

  const name =
      getTag(group.tags, "name") || getTag(group.tags, "d") || "Unnamed group",
    image = getTag(group.tags, "image"),
    description = getTag(group.tags, "description");

  groupEl.classList.remove("hidden");
  groupEl.innerHTML = `
    <div class="group-header-container grid">
      <div class="group-header-image-container">
        <img
          src="${image}"
          alt="${name}"
          onerror="this.src='/images/people.svg'"
        >
        <div class="overlay"></div>
        <div class="group-name">${name}</div>
      </div>
      <div class="group-header-content flex flex-wrap items-center justify-between gap-lg">
        <div class="group-description">${description}</div>
        <div class="group-actions flex items-center gap-lg">
          <a href="/groups" class="btn btn-sm btn-secondary">Change group</a>
          <a href="/create" class="btn btn-sm btn-primary">
            Compose new proposal
          </a>
        </div>
      </div>
    </div>
  `;
};

// Note: Utility functions used across multiple files for common operations
