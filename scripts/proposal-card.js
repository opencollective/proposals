import snarkdown from "./snarkdown.bundle.mjs";
import * as NostrTools from "./nostr-tools.bundle.mjs";
import { setupDateFormatting, getTag, generateUId } from "./utils.js";

export const displayProposal = (event, fetchedProposals) => {
  const { id, kind, pubkey, created_at, content, tags } = event,
    publishedAt = getTag(tags, "published_at"),
    title = getTag(tags, "title"),
    orderUId = getTag(tags, "z"),
    proposalUId = generateUId({ kind, pubkey, tags }),
    pathname = window.location.pathname.slice(1),
    isNpubUrl = pathname.startsWith("npub");

  if (document.querySelector(`[data-proposals-uid="${proposalUId}"]`)) return;

  const nevent = NostrTools.nip19.neventEncode({
      id,
      author: pubkey,
      kind,
      relays: [...activeRelays],
    }),
    npub = NostrTools.nip19.npubEncode(pubkey);

  const noteHTML = `
    <div
      class="proposal-card${kind === 30024 ? ' draft-proposal' : ''}"
      data-proposal-id="${id}"
      data-proposals-uid="${proposalUId}"
      data-created-at="${created_at}"
      data-pubkey="${pubkey}"
    >
      ${!isNpubUrl 
        ? `<a href="/${npub}">
            <img class="user-image" src="https://robohash.org/${pubkey}.png">
          </a>`
        : ""
      }

      <div class="proposal-card-content-container flex flex-col gap-md">
        <div class="grid">
          ${!isNpubUrl
            ? `<a href="/${npub}">
                <div class="user-name">Anonymous</div>
              </a>`
            : ""
          }
          <div class="flex flex-wrap justify-between items-center">
            <div>
              <span 
                class="proposal-card-date date"
                data-timestamp="${publishedAt || created_at}"
                 title="Published at"
              >
                ${(publishedAt || created_at)}
              </span>
              ${
                publishedAt && +publishedAt !== created_at
                  ? `<span class="proposal-card-date date" title="Updated  at">
                      <span>● 📝</span>
                      <span data-timestamp="${created_at}">${(created_at)}</span>
                    </span>`
                  : ""
              }
            </div>
            ${kind === 30024
              ? `<span class="draft-badge">
                  <svg class="draft-badge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 29">
                    <path fill="#656666" d="M18.7 26.4V29H16v-2.6zm2.6 0H24c0 1.5-1.2 2.6-2.7 2.6zm-8 0V29h-2.7v-2.6zm-5.3 0V29H5.3v-2.6zm-5.3 0V29C1.2 29 0 27.8 0 26.4zm18.6-10.6H24v2.6h-2.7zm0-2.6v-2.6H16c-1.5 0-2.7-1.2-2.7-2.6V2.6H2.7v10.5H0V2.6C0 1.2 1.2 0 2.7 0h13.9L24 7.4v5.8zM2.7 15.8v2.6H0v-2.6zm18.6 5.3H24v2.6h-2.7zm-18.6 0v2.6H0v-2.6zM16 3.2v4.7h4.8z"/><path fill="#656666" d="m17.02 14.66-2.69-2.69a.96.96 0 0 0-1.35 0l-7.39 7.4a1 1 0 0 0-.28.68v2.69c0 .53.43.96.96.96h2.69q.4 0 .68-.28l7.39-7.39a.95.95 0 0 0 0-1.36m-8.09 8.07H6.26v-2.69l5.28-5.27 2.68 2.69zm5.96-5.96-2.69-2.69 1.44-1.44 2.69 2.69z"/>
                  </svg>
                  Draft
                </span>`
              : ''
            }
          </div>
        </div>
        <div class="grid gap-sm">
          <a href="/${nevent}" class="main-link">
            <h3 class="title-3">${title}</h3>
          </a>
          <div class="proposal-card-intro">${snarkdown(content)}</div>
        </div>
        <div class="flex flex-wrap gap-lg justify-between items-center">  
          <div class="flex gap-lg proposal-reactions">
            <div class="reaction-item reactions">
              <span class="icon">🤍</span>
              <span class="count"></span>
            </div>
            <div class="reaction-item comments">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 22" class="icon">
                <path fill="#a4a4a5" d="M23.1 20.05a.83.83 0 0 1-.57 1.05 1 1 0 0 1-.5 0l-2.96-.86a7.76 7.76 0 0 1-10.93-4.21 8.4 8.4 0 0 0 3.98-.84 7.6 7.6 0 0 0 3.73-9.32 7.67 7.67 0 0 1 6.37 11.24z" opacity=".2"/>
                <path fill="#a4a4a5" d="M23.14 17.2a8.47 8.47 0 0 0-6.69-12.14A8.6 8.6 0 0 0 5.15.73a8.45 8.45 0 0 0-4.37 11.2l.07.16-.78 2.62a1.7 1.7 0 0 0 2.13 2.11l2.65-.76q1.29.62 2.7.77a8.6 8.6 0 0 0 11.24 4.49l.37-.17 2.65.76a1.7 1.7 0 0 0 2.12-2.11zM4.92 14.28l-.23.04-2.97.86.88-2.94a.8.8 0 0 0-.07-.64 6.76 6.76 0 0 1 2.81-9.2 6.9 6.9 0 0 1 9.28 2.79 6.76 6.76 0 0 1-2.81 9.2 6.9 6.9 0 0 1-6.47 0 2 2 0 0 0-.41-.11m16.47 3.05.88 2.94-2.97-.86a.8.8 0 0 0-.64.07 6.9 6.9 0 0 1-9.18-2.65 8.5 8.5 0 0 0 7.53-9.96 6.8 6.8 0 0 1 4.47 9.82.8.8 0 0 0-.07.65"/>
              </svg>
              <span class="count"></span>
            </div>
          </div>

          <div class="flex items-center gap-sm">
            ${orderUId 
              ? `<div class="proposal-order-id" title="Proposal ID">#${orderUId}</div>` 
              : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;

  fetchedProposals.insertAdjacentHTML("beforeend", noteHTML);
  setupDateFormatting(fetchedProposals.lastElementChild);
  
  // Add click handler to trigger main-link
  fetchedProposals.lastElementChild.onclick = (e) => {
    if (!e.target.closest('.main-link')) e.currentTarget.querySelector('.main-link').click();
  };
  
  Array.from(document.querySelectorAll(".proposal-card"))
    .sort((a, b) => b.dataset.createdAt - a.dataset.createdAt)
    .forEach((proposal) => fetchedProposals.appendChild(proposal));
};