export default {
  async fetch(request, env) {
    const { origin, pathname } = new URL(request.url),
      path = pathname.slice(1); // Remove leading slash

   // Prevent direct access to proposal.html
    if (["proposal.html", "proposal"].includes(path)) {
      return env.ASSETS.fetch(origin + "/404.html");
    }

    if (["profile.html", "profile"].includes(path)) {
      return env.ASSETS.fetch(origin + "/404.html");
    }

    // Handle profile URLs (npub)
    if (path.startsWith("npub1") && !path.includes("/")) {
      return env.ASSETS.fetch(origin + "/profile.html");
    }

    // Handle Open Letter URLs (nevent/naddr or 64-character paths)
    if ((path.startsWith("nevent1") || path.startsWith("naddr1") || (path.length >= 64 && !path.includes("/"))) && !path.startsWith("npub1")) {
      return env.ASSETS.fetch(origin + "/proposal.html");
    }

    return env.ASSETS.fetch(request.url);
  },
};
