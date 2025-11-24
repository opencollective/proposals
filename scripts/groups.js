import { setupScrollObserver, getTag, generateUId } from "./utils.js";
import { fetchGroups } from "./nostr-fetch.js";

const id = document.getElementById.bind(document),
  container = id("groups-container"),
  stateEl = id("state"),
  cache = new Map(),
  savedUid = generateUId(JSON.parse(localStorage.getItem('group') || '{}'));

let newCount = 0,
  oldestTime = null,
  isFetching = false;

const selectGroup = (uid) => {
  localStorage.setItem("group", JSON.stringify(cache.get(uid)));
  document
    .querySelectorAll(".group-card")
    .forEach((c) => c.classList.toggle("selected", c.dataset.groupUid === uid));

  const referrer = document.referrer;
  location.href = referrer.includes(location.origin) ? referrer : "/";
};

const groupCard = (uid, data) => {
  if (document.querySelector(`[data-group-uid="${uid}"]`)) return;
  
  const { tags } = data,
    name = getTag(tags, "name") || getTag(tags, "d") || "Unnamed Group",
    image = getTag(tags, "image"),
    desc = getTag(tags, "description");

  const card = `
    <div
      class="group-card ${savedUid === uid ? 'selected' : ''}"
      data-group-uid="${uid}"
      onclick="selectGroup('${uid}')"
    >
      <img
        src="${image}"
        alt="${name}"
        class="group-image"
        onerror="this.src='/images/people.svg'"
      >
      <div class="group-content">
        <div class="group-name">${name}</div>
        ${desc ? `<div class="group-description">${desc}</div>` : ''}
      </div>
    </div>`;
    
  container.insertAdjacentHTML("beforeend", card);
};

const onComplete = () => {
  isFetching = false;
  if (!newCount) {
    if (stateEl) stateEl.innerHTML = cache.size ? 'All groups loaded' : 'No groups found';
  } else if (newCount < 10) {
    loadGroups();
  } else {
    setupScrollObserver(container, '.group-card', loadGroups);
  }
};

const handleEvent = ([type, subId, data]) => {
  if (type === "EOSE" && subId === window.groupsSubId) {
    onComplete();
  }
  
  if (type === "EVENT" && data.kind === 34550) {
    oldestTime = oldestTime ? Math.min(oldestTime, data.created_at) : data.created_at;
    
    const uid = generateUId(data);
    if (!uid || cache.get(uid)?.created_at >= data.created_at) return;
    
    if (!cache.has(uid)) {
      newCount++;
      groupCard(uid, data);
    }
    cache.set(uid, data);
  }
};

const loadGroups = () => {
  if (isFetching) return;
  isFetching = true;
  newCount = 0;

  const filter = { limit: 20, ...(oldestTime && { until: oldestTime - 1 }) };

  fetchGroups(oldestTime, handleEvent, filter );
};

window.selectGroup = selectGroup;
loadGroups();
