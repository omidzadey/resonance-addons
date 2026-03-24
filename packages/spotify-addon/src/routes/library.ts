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

const PAGE_SIZE = 50;

const libraryV3Variables = (filters: string[], offset = 0) => ({
  filters,
  order: null,
  textFilter: "",
  features: ["LIKED_SONGS", "YOUR_EPISODES"],
  limit: PAGE_SIZE,
  offset,
  flatten: false,
  expandedFolders: [],
  folderUri: null,
  includeFoldersWhenFlattening: true,
  withCuration: false,
});

async function fetchPageLibraryV3(spDc: string, filters: string[], offset = 0) {
  const res = await partnerQuery(spDc, OP.libraryV3, libraryV3Variables(filters, offset));
  const totalCount: number = res?.data?.me?.libraryV3?.totalCount ?? 0;
  const items: any[] = res?.data?.me?.libraryV3?.items ?? [];
  const nextOffset = offset + PAGE_SIZE < totalCount ? offset + PAGE_SIZE : null;
  return { items, totalCount, nextOffset };
}

async function fetchPageLibraryTracks(spDc: string, offset = 0) {
  const res = await partnerQuery(spDc, OP.fetchLibraryTracks, { offset, limit: PAGE_SIZE });
  const totalCount: number = res?.data?.me?.library?.tracks?.totalCount ?? 0;
  const items: any[] = res?.data?.me?.library?.tracks?.items ?? [];
  const nextOffset = offset + PAGE_SIZE < totalCount ? offset + PAGE_SIZE : null;
  return { items, totalCount, nextOffset };
}

function parsePlaylistRows(rows: any[]): any[] {
  const items: any[] = [];
  for (const row of rows) {
    const d = row.item?.data;
    if (!d?.uri) continue;

    const uri: string = d.uri;
    const name: string = d.name ?? "";
    const images = d.images?.items?.[0]?.sources ?? d.image?.sources ?? [];
    const thumbnailURL = bestImage(images);

    if (uri.startsWith("spotify:playlist:")) {
      const attrs = d.attributes ?? [];
      const isDJ = attrs.some((a: any) => a.key === "lexicon_set_type" && a.value === "your_dj");

      items.push({
        type: "playlist",
        playlist: {
          id: isDJ ? "dj" : uriToId(uri),
          provider: PROVIDER_ID,
          title: name,
          author: d.ownerV2?.data?.name ?? null,
          trackCount: null,
          thumbnailURL: isDJ ? "https://lexicon-assets.spotifycdn.com/DJ-Beta-CoverArt-300.jpg" : thumbnailURL,
        },
      });
    } else if (uri === "spotify:collection:tracks") {
      const count = d.count;
      items.push({
        type: "playlist",
        playlist: {
          id: "collection:tracks",
          provider: PROVIDER_ID,
          title: name,
          author: null,
          trackCount: count ? `${count} songs` : null,
          thumbnailURL,
        },
      });
    }
  }
  return items;
}

function parseTrackRows(rows: any[]): any[] {
  const items: any[] = [];
  for (const item of rows) {
    const t = item.track;
    const d = t?.data;
    if (!t?._uri || !d) continue;

    const uri: string = t._uri;
    const name: string = d.name ?? "";
    const artists = (d.artists?.items ?? []).map((a: any) => ({
      id: uriToId(a.uri ?? ""),
      name: a.profile?.name ?? "",
    }));
    const album = d.albumOfTrack;
    const albumUri: string = album?.uri ?? "";
    const albumName: string = album?.name ?? "";
    const albumCoverSources = album?.coverArt?.sources ?? [];
    const ms = d.duration?.totalMilliseconds ?? 0;
    const contentRating: string = d.contentRating?.label ?? "";

    items.push({
      type: "track",
      track: {
        id: uriToId(uri),
        provider: PROVIDER_ID,
        title: name,
        artists,
        album: albumName ? { id: uriToId(albumUri), name: albumName } : null,
        duration: formatDurationMs(ms),
        durationSeconds: Math.round(ms / 1000),
        thumbnailURL: bestImage(albumCoverSources),
        isExplicit: contentRating === "EXPLICIT",
      },
    });
  }
  return items;
}

function parseAlbumRows(rows: any[]): any[] {
  const items: any[] = [];
  for (const row of rows) {
    const d = row.item?.data;
    if (!d?.uri) continue;

    const uri: string = d.uri;
    const name: string = d.name ?? "";
    const artists = (d.artists?.items ?? []).map((a: any) => ({
      id: uriToId(a.uri ?? ""),
      name: a.profile?.name ?? "",
    }));
    const imageSources = d.images?.items?.[0]?.sources ?? d.image?.sources ?? [];

    items.push({
      type: "album",
      album: {
        id: uriToId(uri),
        provider: PROVIDER_ID,
        title: name,
        artists,
        year: null,
        thumbnailURL: bestImage(imageSources),
        isExplicit: false,
      },
    });
  }
  return items;
}

function parseArtistRows(rows: any[]): any[] {
  const items: any[] = [];
  for (const row of rows) {
    const d = row.item?.data;
    if (!d?.uri) continue;

    const uri: string = d.uri;
    const profileName: string = d.profile?.name ?? "";
    const avatarSources = d.visuals?.avatarImage?.sources ?? [];

    items.push({
      type: "artist",
      artist: {
        id: uriToId(uri),
        provider: PROVIDER_ID,
        name: profileName,
        thumbnailURL: bestImage(avatarSources),
        subscriberCount: null,
      },
    });
  }
  return items;
}

export async function handleLibrary(spDc: string, type?: string, continuation?: string): Promise<Response> {
  try {
    const offset = continuation ? parseInt(continuation, 10) : 0;

    if (type) {
      let items: any[] = [];
      let continuationToken: string | undefined;

      switch (type) {
        case "playlists": {
          const page = await fetchPageLibraryV3(spDc, ["Playlists"], offset);
          items = parsePlaylistRows(page.items);
          if (page.nextOffset !== null) continuationToken = String(page.nextOffset);
          break;
        }
        case "songs": {
          const page = await fetchPageLibraryTracks(spDc, offset);
          items = parseTrackRows(page.items);
          if (page.nextOffset !== null) continuationToken = String(page.nextOffset);
          break;
        }
        case "albums": {
          const page = await fetchPageLibraryV3(spDc, ["Albums"], offset);
          items = parseAlbumRows(page.items);
          if (page.nextOffset !== null) continuationToken = String(page.nextOffset);
          break;
        }
        case "artists": {
          const page = await fetchPageLibraryV3(spDc, ["Artists"], offset);
          items = parseArtistRows(page.items);
          if (page.nextOffset !== null) continuationToken = String(page.nextOffset);
          break;
        }
        default:
          return errorResponse(`Unknown library type: ${type}`, 400);
      }

      const title = type.charAt(0).toUpperCase() + type.slice(1);
      const section: any = { id: crypto.randomUUID(), title, items, style: "cards" };
      if (continuationToken) section.continuationToken = continuationToken;

      return json({
        sections: items.length ? [section] : [],
        filters: [],
        quickAccess: null,
        continuation: null,
      });
    }

    const [playlists, tracks, albums, artists] = await Promise.all([
      fetchPageLibraryV3(spDc, ["Playlists"]),
      fetchPageLibraryTracks(spDc),
      fetchPageLibraryV3(spDc, ["Albums"]),
      fetchPageLibraryV3(spDc, ["Artists"]),
    ]);

    const sections: any[] = [];

    const playlistItems = parsePlaylistRows(playlists.items);
    if (playlistItems.length) {
      const section: any = { id: crypto.randomUUID(), title: "Playlists", items: playlistItems, style: "cards" };
      if (playlists.nextOffset !== null) section.continuationToken = String(playlists.nextOffset);
      sections.push(section);
    }

    const trackItems = parseTrackRows(tracks.items);
    if (trackItems.length) {
      const section: any = { id: crypto.randomUUID(), title: "Songs", items: trackItems, style: "cards" };
      if (tracks.nextOffset !== null) section.continuationToken = String(tracks.nextOffset);
      sections.push(section);
    }

    const albumItems = parseAlbumRows(albums.items);
    if (albumItems.length) {
      const section: any = { id: crypto.randomUUID(), title: "Albums", items: albumItems, style: "cards" };
      if (albums.nextOffset !== null) section.continuationToken = String(albums.nextOffset);
      sections.push(section);
    }

    const artistItems = parseArtistRows(artists.items);
    if (artistItems.length) {
      const section: any = { id: crypto.randomUUID(), title: "Artists", items: artistItems, style: "cards" };
      if (artists.nextOffset !== null) section.continuationToken = String(artists.nextOffset);
      sections.push(section);
    }

    return json({
      sections,
      filters: [],
      quickAccess: null,
      continuation: null,
    });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("Library error:", e.message);
    return errorResponse(e.message, 500);
  }
}
