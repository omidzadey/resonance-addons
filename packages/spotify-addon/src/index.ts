import { handleConfigure } from "./configure";
import { handleAlbum } from "./routes/album";
import { handleArtist } from "./routes/artist";
import { handleHome } from "./routes/catalog";
import { handleDJPlaylist } from "./routes/dj";
import { handleLibrary } from "./routes/library";
import { handleLyrics } from "./routes/lyrics";
import { handleManifest } from "./routes/manifest";
import { handleMetadata } from "./routes/metadata";
import { handleAddToPlaylist, handleLikedSongs, handlePlaylist, handlePlaylistMore } from "./routes/playlist";
import { handleRelated, handleRelatedForTrack } from "./routes/related";
import { handleSearch, handleSearchSuggestions } from "./routes/search";
import { handleTTS } from "./routes/tts";
import { corsHeaders, errorResponse, json, parseConfig } from "./utils";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

function getBaseURL(req: Request): string {
  const host = req.headers.get("host") ?? `localhost:${PORT}`;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

Bun.serve({
  port: PORT,
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (path === "/" || path === "/configure") {
      return handleConfigure(getBaseURL(req));
    }

    if (path === "/health") {
      return json({ status: "ok" });
    }

    if (req.method === "GET" && path === "/manifest.json") {
      return handleManifest(getBaseURL(req), null);
    }

    const match = path.match(/^\/([^/]+)(\/.*)?$/);
    if (!match) {
      return errorResponse("Not found", 404);
    }

    const configStr = match[1]!;
    const route = match[2] ?? "/";

    let config;
    try {
      config = parseConfig(configStr);
    } catch {
      return errorResponse("Invalid config in URL — configure at /configure", 400);
    }

    const baseURL = getBaseURL(req);
    const { spDc } = config;

    if (route === "/manifest.json") {
      return handleManifest(baseURL, configStr);
    }

    if (req.method === "GET") {
      if (route === "/catalog/home.json") {
        return handleHome(spDc);
      }

      if (route === "/catalog/library.json") {
        const type = url.searchParams.get("type") ?? undefined;
        const continuation = url.searchParams.get("continuation") ?? undefined;
        return handleLibrary(spDc, type, continuation);
      }

      if (route === "/search.json") {
        const q = url.searchParams.get("q");
        if (!q) return errorResponse("Missing query parameter 'q'", 400);
        const filter = url.searchParams.get("filter") ?? undefined;
        return handleSearch(spDc, q, filter);
      }

      if (route === "/search/suggestions.json") {
        const q = url.searchParams.get("q");
        if (!q) return json([]);
        return handleSearchSuggestions(spDc, q);
      }

      const albumMatch = route.match(/^\/album\/([^/]+)\.json$/);
      if (albumMatch?.[1]) {
        return handleAlbum(spDc, albumMatch[1]);
      }

      const artistMatch = route.match(/^\/artist\/([^/]+)\.json$/);
      if (artistMatch?.[1]) {
        return handleArtist(spDc, artistMatch[1]);
      }

      if (route === "/playlist/collection:tracks.json") {
        return handleLikedSongs(spDc);
      }

      if (route === "/playlist/dj.json") {
        return handleDJPlaylist(spDc);
      }

      const playlistMoreMatch = route.match(/^\/playlist\/([^/]+)\/more\.json$/);
      if (playlistMoreMatch?.[1]) {
        const cont = url.searchParams.get("continuation");
        if (!cont) return errorResponse("Missing continuation parameter", 400);
        return handlePlaylistMore(spDc, decodeURIComponent(playlistMoreMatch[1]), cont);
      }

      const playlistMatch = route.match(/^\/playlist\/([^/]+)\.json$/);
      if (playlistMatch?.[1]) {
        return handlePlaylist(spDc, playlistMatch[1]);
      }

      const relatedForTrackMatch = route.match(/^\/related-for-track\/([^/]+)\.json$/);
      if (relatedForTrackMatch?.[1]) {
        return handleRelatedForTrack(spDc, decodeURIComponent(relatedForTrackMatch[1]));
      }

      const relatedMatch = route.match(/^\/related\/([^/]+)\.json$/);
      if (relatedMatch?.[1]) {
        return handleRelated(spDc, decodeURIComponent(relatedMatch[1]));
      }

      if (route === "/metadata.json") {
        const title = url.searchParams.get("title") ?? undefined;
        const artist = url.searchParams.get("artist") ?? undefined;
        return handleMetadata(spDc, title, artist);
      }

      if (route === "/lyrics.json") {
        const title = url.searchParams.get("title") ?? undefined;
        const artist = url.searchParams.get("artist") ?? undefined;
        const videoId = url.searchParams.get("videoId") ?? undefined;
        return handleLyrics(spDc, title, artist, videoId);
      }
    }

    if (req.method === "GET" && route === "/tts/voices.json") {
      return json([
        { id: "1", name: "Voice 1" },
        { id: "2", name: "Voice 2" },
        { id: "3", name: "Voice 3" },
        { id: "4", name: "Voice 4" },
        { id: "5", name: "Voice 5" },
        { id: "6", name: "Voice 6" },
        { id: "7", name: "Voice 7" },
        { id: "8", name: "Voice 8" },
      ]);
    }

    if (req.method === "POST" && route === "/playlist/add") {
      const body = (await req.json()) as any;
      return handleAddToPlaylist(spDc, body);
    }

    if (req.method === "POST" && route === "/tts") {
      return handleTTS(spDc, req);
    }

    return errorResponse("Not found", 404);
  },
});

console.log(`Spotify addon server running on http://localhost:${PORT}`);
console.log(`Configure at http://localhost:${PORT}/configure`);

import { scrapeSecret } from "./auth";
import { prewarmClientToken } from "./partner";

Promise.all([scrapeSecret(), prewarmClientToken()]).catch(() => {});
