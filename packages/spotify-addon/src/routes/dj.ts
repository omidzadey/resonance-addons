import { getAccessToken, spotifyFetch } from "../auth";
import { OP, partnerQuery } from "../partner";
import {
  bestImage,
  errorResponse,
  formatDurationMs,
  isOnDeviceFetchSignal,
  json,
  PROVIDER_ID,
  uriToId,
} from "../utils";

const DJ_CONTEXT_URI = "spotify:playlist:37i9dQZF1EYkqdzj48dyYq";
const DJ_COVER = "https://lexicon-assets.spotifycdn.com/DJ-Beta-CoverArt-300.jpg";
const LEXICON_BASE = "https://spclient.wg.spotify.com/lexicon-session-provider/";

function fixLexiconUrl(url: string): string {
  return url.replace(/^hm:\/\/lexicon-session-provider\//, LEXICON_BASE);
}

interface LexiconPage {
  tracks: Array<{ uri: string; metadata: Record<string, string> }>;
  nextPageUrl: string | null;
}

async function fetchLexiconSession(token: string, url: string): Promise<LexiconPage> {
  const res = await spotifyFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "app-platform": "WebPlayer",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Lexicon fetch failed (${res.status})`);
  const data = (await res.json()) as any;

  const tracks: LexiconPage["tracks"] = [];

  const page = data.pages?.[0] ?? data;
  for (const t of page.tracks ?? []) {
    tracks.push({
      uri: t.uri ?? "",
      metadata: t.metadata ?? {},
    });
  }

  const nextPageUrl = page.next_page_url ? fixLexiconUrl(page.next_page_url) : null;

  return { tracks, nextPageUrl };
}

async function collectPages(
  token: string,
  startUrl: string,
  maxPages: number,
): Promise<{ allTracks: LexiconPage["tracks"]; nextPageUrl: string | null }> {
  let allTracks: LexiconPage["tracks"] = [];
  let url: string | null = startUrl;

  for (let i = 0; i < maxPages && url; i++) {
    const page = await fetchLexiconSession(token, url);
    allTracks = allTracks.concat(page.tracks);
    url = page.nextPageUrl;
  }

  return { allTracks, nextPageUrl: url };
}

async function resolveTrack(spDc: string, trackUri: string) {
  const data = await partnerQuery(spDc, OP.getTrack, { uri: trackUri });
  const t = data?.data?.trackUnion;
  if (!t) return null;

  const durationMs = t.duration?.totalMilliseconds ?? 0;
  const artists = (t.firstArtist?.items ?? []).map((a: any) => ({
    id: a.uri ? uriToId(a.uri) : null,
    name: a.profile?.name ?? "",
  }));
  const isExplicit = t.contentRating?.label === "EXPLICIT" || t.contentRating?.label === "explicit";

  const albumData = t.albumOfTrack;
  const thumbnailURL = bestImage(albumData?.coverArt?.sources ?? []);

  return {
    id: uriToId(trackUri),
    provider: PROVIDER_ID,
    title: t.name ?? "",
    artists,
    album: albumData ? { id: albumData.uri ? uriToId(albumData.uri) : null, name: albumData.name ?? "" } : null,
    duration: durationMs > 0 ? formatDurationMs(durationMs) : null,
    durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : null,
    thumbnailURL,
    isExplicit,
  };
}

async function resolveAllTracks(spDc: string, lexiconTracks: LexiconPage["tracks"]) {
  const results = await Promise.all(
    lexiconTracks.filter((t) => t.uri.includes("track")).map((t) => resolveTrack(spDc, t.uri)),
  );
  return results.filter(Boolean);
}

const SESSION_URL = `${LEXICON_BASE}context-resolve/v2/session?contextUri=${DJ_CONTEXT_URI}`;

export async function handleDJPlaylist(spDc: string): Promise<Response> {
  try {
    const token = await getAccessToken(spDc);
    const { allTracks } = await collectPages(token, SESSION_URL, 3);
    const tracks = await resolveAllTracks(spDc, allTracks);

    return json({
      id: "dj",
      title: "DJ",
      author: "Spotify",
      description: "Your personalized DJ mix",
      trackCount: null,
      thumbnailURL: DJ_COVER,
      tracks,
      continuation: null,
    });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("DJ playlist error:", e.message);
    return errorResponse(e.message, 500);
  }
}
