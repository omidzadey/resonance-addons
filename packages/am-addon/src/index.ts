import { handleConfigure } from "./configure";
import { handleLyrics } from "./routes/lyrics";
import { handleManifest } from "./routes/manifest";
import { handleMetadata } from "./routes/metadata";
import { setUserToken } from "./token";
import { corsHeaders, errorResponse, json, parseConfig } from "./utils";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

function getBaseURL(req: Request): string {
  const host = req.headers.get("host") ?? `localhost:${PORT}`;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

Bun.serve({
  port: PORT,
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

    setUserToken(config.userToken);

    const baseURL = getBaseURL(req);

    if (route === "/manifest.json") {
      return handleManifest(baseURL, configStr);
    }

    if (route === "/lyrics.json") {
      const title = url.searchParams.get("title") ?? undefined;
      const artist = url.searchParams.get("artist") ?? undefined;
      const videoId = url.searchParams.get("videoId") ?? undefined;
      return handleLyrics(title, artist, videoId);
    }

    if (route === "/metadata.json") {
      const title = url.searchParams.get("title") ?? undefined;
      const artist = url.searchParams.get("artist") ?? undefined;
      return handleMetadata(title, artist);
    }

    return errorResponse("Not found", 404);
  },
});

console.log(`AM addon server running on http://localhost:${PORT}`);
console.log(`Configure at http://localhost:${PORT}/configure`);
