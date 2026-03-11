import { getAccessToken } from "../auth";
import { errorResponse, json, PROVIDER_ID, uriToId } from "../utils";

export async function handleArtist(spDc: string, artistId: string): Promise<Response> {
  try {
    const token = await getAccessToken(spDc);
    const res = await fetch(`https://spclient.wg.spotify.com/artistview/v1/artist/${artistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "app-platform": "iOS",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return errorResponse(`Artist fetch failed (${res.status})`, res.status);
    }

    const data = (await res.json()) as any;

    const name = data.title ?? "";
    const thumbnailURL = data.header?.images?.main?.uri ?? null;
    const subtitle = data.header?.text?.accessory ?? null;

    const body: any[] = data.body ?? [];
    const bodyMap = new Map<string, any>();
    for (const section of body) {
      if (section.id) bodyMap.set(section.id, section);
    }

    const topTracks: any[] = [];
    for (let i = 0; i < 10; i++) {
      const row = bodyMap.get(`artist-entity-view-top-tracks-combined_row${i}`);
      if (!row) continue;
      const trackUri: string = row.metadata?.uri ?? "";
      if (!trackUri.includes("track")) continue;
      const albumUri: string = row.metadata?.album_uri ?? "";
      const customArtists = row.custom?.artists ?? [];
      const artists =
        customArtists.length > 0
          ? customArtists.map((a: any) => ({ id: a.uri ? uriToId(a.uri) : null, name: a.name ?? "" }))
          : [{ id: artistId, name }];
      topTracks.push({
        id: uriToId(trackUri),
        provider: PROVIDER_ID,
        title: row.text?.title ?? "",
        artists,
        album: albumUri ? { id: uriToId(albumUri), name: "" } : null,
        duration: null,
        durationSeconds: null,
        thumbnailURL: row.images?.main?.uri ?? null,
        isExplicit: row.metadata?.explicit ?? false,
      });
    }

    const albums: any[] = [];
    const singles: any[] = [];
    for (let i = 0; i < 10; i++) {
      const row = bodyMap.get(`artist-entity-view-releases_row${i}`);
      if (!row) continue;
      const albumUri: string = row.metadata?.uri ?? "";
      if (!albumUri.includes("album")) continue;
      const subtitleText: string = row.text?.subtitle ?? "";
      const year = subtitleText.match(/\d{4}/)?.[0] ?? null;
      const isSingle = /single/i.test(subtitleText);
      const entry = {
        id: uriToId(albumUri),
        provider: PROVIDER_ID,
        title: row.text?.title ?? "",
        artists: [{ id: artistId, name }],
        year,
        thumbnailURL: row.images?.main?.uri ?? null,
        isExplicit: false,
      };
      if (isSingle) {
        singles.push(entry);
      } else {
        albums.push(entry);
      }
    }

    const relatedSection = bodyMap.get("artist-entity-view-related");
    const relatedArtists: any[] = [];
    for (const child of relatedSection?.children ?? []) {
      const childUri: string = child.metadata?.uri ?? "";
      if (!childUri.includes("artist")) continue;
      relatedArtists.push({
        id: uriToId(childUri),
        provider: PROVIDER_ID,
        name: child.text?.title ?? "",
        thumbnailURL: child.images?.main?.uri ?? null,
        subscriberCount: null,
      });
    }

    return json({
      id: artistId,
      name,
      thumbnailURL,
      subtitle,
      topTracks,
      albums,
      singles,
      playlists: [],
      relatedArtists,
    });
  } catch (e: any) {
    console.error("Artist error:", e.message);
    return errorResponse(e.message, 500);
  }
}
