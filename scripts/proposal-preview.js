import snarkdown from "./snarkdown.bundle.mjs";
import * as NostrTools from "./nostr-tools.bundle.mjs";
import { updateBreadcrumb } from "./breadcrumb.js";
import {
  getTag,
  generateUId,
  linkifyNostr,
  setupDateFormatting,
} from "./utils.js";

const query = document.querySelector.bind(document);

// Render proposal preview on proposal page
export const renderProposalPreview = (proposal, container) => {
  if (!proposal) return; // No proposal to render

  // Extract proposal data
  const { created_at, content, tags, pubkey } = proposal,
    title = getTag(tags, "title"),
    orderUId = getTag(tags, "z"), // Unique order ID
    publishedAt = getTag(tags, "published_at"), // Original publish timestamp
    aTag = getTag(tags, "A"), // Group reference
    uid = generateUId(proposal),
    npub = NostrTools.nip19.npubEncode(pubkey);

  // Process content: preserve HTML tags, convert markdown for other lines
  const processedContent = content
    .split("\n")
    .map((line) => {
      if (/<(video|source|iframe|img|audio)[^>]*>/i.test(line)) return line; // Keep HTML
      return snarkdown(linkifyNostr(line)); // Convert markdown
    })
    .join("\n");

  // Update breadcrumb and page title
  updateBreadcrumb(title);
  document.title = (title ? `${title} - ` : "") + "Open Collective - Proposal";

  container.innerHTML = `
    <div class="flex flex-col gap-lg" data-proposals-uid="${uid}" data-pubkey="${pubkey}">
     
      <div class="flex gap-sm items-center">
        <a href="/${npub}">
          <img
            class="user-image"
            src="https://robohash.org/${pubkey}.png?bgset=bg2&size=40x40"
            alt="User avatar"
          />
        </a>
        <div class="flex flex-col flex-grow gap-xs text-sm">
          <div><a href="/${npub}" class="user-name">Anonymous</a></div>
          <div class="date-info-container flex justify-between items-center">
            <div id="date-info-wrapper">
              <span data-timestamp="${publishedAt || created_at}" title="Published at">
                ${publishedAt || created_at}
              </span>
              ${
                publishedAt && +publishedAt !== created_at
                  ? `<span class="seperator-dot">●</span>
                  <span title="Updated at">
                    📝
                    <span data-timestamp="${created_at}">
                      ${created_at}
                    </span>
                  </span>`
                  : ""
              }
            </div>
          </div>
        </div>
        <div class="grid gap-sm" id="proposal-actions-container">
          ${
            proposal.kind === 30024
              ? `<div class="draft-badge">
                <svg class="draft-badge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 29">
                  <path fill="#656666" d="M18.7 26.4V29H16v-2.6zm2.6 0H24c0 1.5-1.2 2.6-2.7 2.6zm-8 0V29h-2.7v-2.6zm-5.3 0V29H5.3v-2.6zm-5.3 0V29C1.2 29 0 27.8 0 26.4zm18.6-10.6H24v2.6h-2.7zm0-2.6v-2.6H16c-1.5 0-2.7-1.2-2.7-2.6V2.6H2.7v10.5H0V2.6C0 1.2 1.2 0 2.7 0h13.9L24 7.4v5.8zM2.7 15.8v2.6H0v-2.6zm18.6 5.3H24v2.6h-2.7zm-18.6 0v2.6H0v-2.6zM16 3.2v4.7h4.8z"/>
                  <path fill="#656666" d="m17.02 14.66-2.69-2.69a.96.96 0 0 0-1.35 0l-7.39 7.4a1 1 0 0 0-.28.68v2.69c0 .53.43.96.96.96h2.69q.4 0 .68-.28l7.39-7.39a.95.95 0 0 0 0-1.36m-8.09 8.07H6.26v-2.69l5.28-5.27 2.68 2.69zm5.96-5.96-2.69-2.69 1.44-1.44 2.69 2.69z"/>
                </svg>
                Draft
              </div>`
              : ""
          }
        </div>
      </div>
      ${title ? `<h1 class="title">${title}</h1>` : ""}

      <div class="description markdown">${processedContent}</div>

      <div class="flex flex-wrap gap-lg justify-between items-center">
        <div class="proposal-related flex items-center gap-lg">
          <div class="reaction-item reactions">
            <span class="icon" title="React">&#129293;</span>
            <span class="count" title="See reactions"></span>
          </div>
          <span class="seperator-dot">●</span>
          <div class="reaction-item comments">
            <span class="icon" title="Comment">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22">
                <path fill="#a4a4a5" d="M23.1 20.05a.83.83 0 0 1-.57 1.05 1 1 0 0 1-.5 0l-2.96-.86a7.76 7.76 0 0 1-10.93-4.21 8.4 8.4 0 0 0 3.98-.84 7.6 7.6 0 0 0 3.73-9.32 7.67 7.67 0 0 1 6.37 11.24z" opacity=".2"/>
                <path fill="#a4a4a5" d="M23.14 17.2a8.47 8.47 0 0 0-6.69-12.14A8.6 8.6 0 0 0 5.15.73a8.45 8.45 0 0 0-4.37 11.2l.07.16-.78 2.62a1.7 1.7 0 0 0 2.13 2.11l2.65-.76q1.29.62 2.7.77a8.6 8.6 0 0 0 11.24 4.49l.37-.17 2.65.76a1.7 1.7 0 0 0 2.12-2.11zM4.92 14.28l-.23.04-2.97.86.88-2.94a.8.8 0 0 0-.07-.64 6.76 6.76 0 0 1 2.81-9.2 6.9 6.9 0 0 1 9.28 2.79 6.76 6.76 0 0 1-2.81 9.2 6.9 6.9 0 0 1-6.47 0 2 2 0 0 0-.41-.11m16.47 3.05.88 2.94-2.97-.86a.8.8 0 0 0-.64.07 6.9 6.9 0 0 1-9.18-2.65 8.5 8.5 0 0 0 7.53-9.96 6.8 6.8 0 0 1 4.47 9.82.8.8 0 0 0-.07.65"/>
              </svg>
            </span>
            <span class="count" title="See comments"></span>
          </div>
        </div>
        
        <div class="flex items-center gap-sm">
          ${
            orderUId
              ? `<div class="proposal-order-id" title="Proposal ID">#${orderUId}</div>`
              : ""
          }
        </div>
      </div>

    </div>
  `;

  // Setup click handlers and date formatting
  setupProposalInteractions(container, proposal);
  setupDateFormatting(container);

  // Listen for group data if proposal has group reference
  if (aTag) {
    window.addEventListener(
      "groupReceived",
      (e) => {
        const wrapper = document.getElementById("date-info-wrapper");
        if (!wrapper) return;

        // Add group pill to date info
        const { name, image } = e.detail;
        wrapper.insertAdjacentHTML(
          "afterbegin",
          `
        <span id="group-pill">
          <img src="${image}" alt="${name}" onerror="this.src='/images/people.svg'">
          <span>${name}</span>
        </span>
        <span class="seperator-dot">●</span>
      `,
        );
      },
      { once: true },
    ); // Listen once
  }
};

// Setup click handlers for reactions and comments
const setupProposalInteractions = (container, proposal) => {
  const reactionsCount = container.querySelector(
      ".reaction-item.reactions .count",
    ),
    commentsIcon = container.querySelector(".reaction-item.comments .icon"),
    commentsCount = container.querySelector(".reaction-item.comments .count");

  // Reactions count: toggle reactions container visibility
  reactionsCount?.addEventListener("click", () => {
    const reactionsContainer = document.querySelector(".reactions-container");
    reactionsContainer?.classList.toggle("hidden");
    reactionsContainer?.scrollIntoView();
  });

  // Comments icon: scroll to comments and focus input
  commentsIcon?.addEventListener("click", () => {
    query(".comments-container")?.scrollIntoView();
    document.getElementById("comment-input")?.focus();
  });

  // Comments count: scroll to comment input
  commentsCount?.addEventListener("click", () => {
    document.querySelector(".comment-inputs-container")?.scrollIntoView();
  });
};

// Flow: renderProposalPreview (extract data & process content) → build HTML (with draft badge if kind 30024) → setupProposalInteractions (click handlers) → setupDateFormatting → listen for groupReceived event
