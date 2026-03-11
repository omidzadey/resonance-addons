import { getAccessToken } from "../auth";
import { formatDurationSec, json, PROVIDER_ID, uriToId } from "../utils";

interface SearchHit {
  uri: string;
  name: string;
  image?: string;
  artists: { name: string; uri?: string }[];
  album?: { name: string; uri?: string };
  duration?: number;
  explicit?: boolean;
}

interface FullSearchResponse {
  results: {
    tracks?: { hits: SearchHit[] };
    albums?: { hits: SearchHit[] };
    artists?: { hits: SearchHit[] };
    playlists?: { hits: (SearchHit & { followersCount?: number; author?: string })[] };
  };
}

export async function searchSpotifyTrack(
  token: string,
  title: string,
  artist: string,
): Promise<{ id: string; image: string | null } | null> {
  const query = encodeURIComponent(`${title} ${artist}`);
  const res = await fetch(
    `https://spclient.wg.spotify.com/searchview/km/v4/search/${query}?limit=5&entityType=track&catalogue=&country=US&locale=en&platform=web`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "app-platform": "WebPlayer",
      },
    },
  );

  if (!res.ok) {
    console.log(`[search] HTTP ${res.status}`);
    return null;
  }

  const data = (await res.json()) as FullSearchResponse;
  const hits = data?.results?.tracks?.hits ?? [];
  if (!hits.length) return null;

  const artistLower = artist.toLowerCase();
  for (const hit of hits) {
    for (const a of hit.artists) {
      const name = a.name.toLowerCase();
      if (name.includes(artistLower) || artistLower.includes(name)) {
        return { id: uriToId(hit.uri), image: hit.image ?? null };
      }
    }
  }

  return { id: uriToId(hits[0]!.uri), image: hits[0]!.image ?? null };
}

export async function handleSearch(spDc: string, query: string, filter?: string): Promise<Response> {
  try {
    const token = await getAccessToken(spDc);
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://spclient.wg.spotify.com/searchview/km/v4/search/${encoded}?limit=20&entityType=track,album,artist,playlist&catalogue=&country=US&locale=en&platform=web`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "app-platform": "WebPlayer",
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return json([]);
    }

    const data = (await res.json()) as FullSearchResponse;
    const results = data?.results ?? {};
    const items: any[] = [];

    if (!filter || filter === "tracks") {
      for (const hit of results.tracks?.hits ?? []) {
        items.push({
          type: "track",
          track: {
            id: uriToId(hit.uri),
            provider: PROVIDER_ID,
            title: hit.name,
            artists: hit.artists.map((a) => ({
              id: a.uri ? uriToId(a.uri) : null,
              name: a.name,
            })),
            album: hit.album ? { id: hit.album.uri ? uriToId(hit.album.uri) : null, name: hit.album.name } : null,
            duration: hit.duration ? formatDurationSec(hit.duration / 1000) : null,
            durationSeconds: hit.duration ? Math.round(hit.duration / 1000) : null,
            thumbnailURL: hit.image ?? null,
            isExplicit: !!hit.explicit,
          },
        });
      }
    }

    if (!filter || filter === "albums") {
      for (const hit of results.albums?.hits ?? []) {
        items.push({
          type: "album",
          album: {
            id: uriToId(hit.uri),
            provider: PROVIDER_ID,
            title: hit.name,
            artists: (hit.artists ?? []).map((a) => ({
              id: a.uri ? uriToId(a.uri) : null,
              name: a.name,
            })),
            year: null,
            thumbnailURL: hit.image ?? null,
            isExplicit: false,
          },
        });
      }
    }

    if (!filter || filter === "artists") {
      for (const hit of results.artists?.hits ?? []) {
        items.push({
          type: "artist",
          artist: {
            id: uriToId(hit.uri),
            provider: PROVIDER_ID,
            name: hit.name,
            thumbnailURL: hit.image ?? null,
            subscriberCount: null,
          },
        });
      }
    }

    if (!filter || filter === "playlists") {
      for (const hit of (results.playlists?.hits ?? []) as any[]) {
        items.push({
          type: "playlist",
          playlist: {
            id: uriToId(hit.uri),
            provider: PROVIDER_ID,
            title: hit.name,
            author: hit.author ?? null,
            trackCount: null,
            thumbnailURL: hit.image ?? null,
          },
        });
      }
    }

    return json(items);
  } catch (e: any) {
    console.error("Search error:", e.message);
    return json([]);
  }
}

export async function handleSearchSuggestions(spDc: string, query: string): Promise<Response> {
  try {
    const token = await getAccessToken(spDc);
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://spclient.wg.spotify.com/searchview/km/v4/suggestions/${encoded}?limit=10&catalogue=&country=US&locale=en&platform=web`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "app-platform": "WebPlayer",
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) return json([]);

    const data = (await res.json()) as any;
    const suggestions: string[] = [];

    const hits = data?.results?.suggestions?.hits ?? data?.suggestions ?? [];
    for (const hit of hits) {
      const text = hit?.query ?? hit?.name ?? hit?.text;
      if (typeof text === "string" && text.trim()) {
        suggestions.push(text.trim());
      }
    }

    return json(suggestions);
  } catch (e: any) {
    console.error("Search suggestions error:", e.message);
    return json([]);
  }
}
