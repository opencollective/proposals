import { browse } from "./browse.js";
import {
  getFromLocalStorage,
  showSelectedGroup,
  generateUId,
} from "./utils.js";
import * as NostrTools from "./nostr-tools.bundle.mjs";
import { fetchGroups } from "./nostr-fetch.js";

const path = window.location.pathname.slice(1).split("#")[0],
  isGroup = path.startsWith("group/"),
  cleanPath = isGroup ? path.slice(6) : path;
let groupParam = null;

if (cleanPath.startsWith("naddr")) {
  groupParam = cleanPath;
} else if (cleanPath.startsWith("34550")) {
  const [kind, pubkey, identifier] = decodeURIComponent(cleanPath).split(":");
  if (pubkey && identifier)
    groupParam = { kind: parseInt(kind), pubkey, identifier };
}

if (groupParam) {
  try {
    const data =
      typeof groupParam === "string"
        ? NostrTools.nip19.decode(groupParam).data
        : groupParam;

    if (data.kind === 34550) {
      const stored = getFromLocalStorage("group");
      const uid = `${data.kind}:${data.pubkey}:${data.identifier}`;

      if (uid === generateUId(stored || {}) && stored) {
        showSelectedGroup();
        browse().load();
      } else {
        fetchGroups(
          { authors: [data.pubkey], "#d": [data.identifier] },
          (groupData) => {
            localStorage.setItem("group", JSON.stringify(groupData));
            showSelectedGroup();
          },
          () => {
            browse().load();
          },
        );
      }
    } else {
      window.location.href = "/";
    }
  } catch (e) {
    console.error("Invalid group parameter", e);
  }
} else {
  showSelectedGroup();
  browse().load();
}
