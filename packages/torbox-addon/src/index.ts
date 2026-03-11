import { handleConfigure } from "./configure";
import { handleManifest } from "./routes/manifest";
import { handleSearch } from "./routes/search";
import { handleStream } from "./routes/stream";
import { corsHeaders, errorResponse, json, parseConfig } from "./utils";

const PORT = parseInt(process.env.PORT ?? "3003", 10);

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

    const baseURL = getBaseURL(req);
    const { apiKey } = config;

    if (route === "/manifest.json") {
      return handleManifest(baseURL, configStr);
    }

    if (req.method === "GET") {
      if (route === "/catalog/home.json" || route === "/catalog/library.json") {
        return json({ sections: [], filters: [] });
      }

      if (route === "/search.json") {
        const q = url.searchParams.get("q");
        if (!q) return errorResponse("Missing query parameter 'q'", 400);
        const filter = url.searchParams.get("filter") ?? undefined;
        const context = {
          title: url.searchParams.get("title") ?? undefined,
          artist: url.searchParams.get("artist") ?? undefined,
          album: url.searchParams.get("album") ?? undefined,
        };
        return handleSearch(apiKey, q, filter, context);
      }

      const streamMatch = route.match(/^\/stream\/([^/]+)\.json$/);
      if (streamMatch?.[1]) {
        return handleStream(apiKey, streamMatch[1], config.allowUncached ?? false);
      }
    }

    return errorResponse("Not found", 404);
  },
});

console.log(`TorBox addon server running on http://localhost:${PORT}`);
console.log(`Configure at http://localhost:${PORT}/configure`);
