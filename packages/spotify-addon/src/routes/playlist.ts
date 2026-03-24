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

function parseLikedTrack(item: any) {
  const t = item.track?.data;
  if (!t?._uri && !item.track?._uri) return null;
  const uri = item.track._uri;
  if (!uri.includes("track")) return null;

  const durationMs = t.duration?.totalMilliseconds ?? 0;
  const artists = (t.artists?.items ?? []).map((a: any) => ({
    id: a.uri ? uriToId(a.uri) : null,
    name: a.profile?.name ?? "",
  }));
  const albumData = t.albumOfTrack;
  const trackThumbnail = bestImage(albumData?.coverArt?.sources ?? []);
  const isExplicit = t.contentRating?.label === "EXPLICIT" || t.contentRating?.label === "explicit";

  return {
    id: uriToId(uri),
    provider: PROVIDER_ID,
    title: t.name ?? "",
    artists,
    album: albumData
      ? {
          id: albumData.uri ? uriToId(albumData.uri) : null,
          name: albumData.name ?? "",
        }
      : null,
    duration: durationMs > 0 ? formatDurationMs(durationMs) : null,
    durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : null,
    thumbnailURL: trackThumbnail,
    isExplicit,
  };
}

function parsePlaylistTrack(item: any, fallbackThumbnail: string | null) {
  const raw = item.itemV2?.data;
  if (!raw) return null;
  const t = raw.__typename === "TrackResponseWrapper" ? raw.data : raw;
  if (!t?.uri || !t.uri.includes("track")) return null;

  const durationMs = t.duration?.totalMilliseconds ?? t.trackDuration?.totalMilliseconds ?? 0;
  const artists = (t.artists?.items ?? []).map((a: any) => ({
    id: a.uri ? uriToId(a.uri) : null,
    name: a.profile?.name ?? "",
  }));
  const albumData = t.albumOfTrack;
  const trackThumbnail = bestImage(albumData?.coverArt?.sources ?? []) ?? fallbackThumbnail;
  const isExplicit = t.contentRating?.label === "EXPLICIT" || t.contentRating?.label === "explicit";

  return {
    id: uriToId(t.uri),
    provider: PROVIDER_ID,
    title: t.name ?? "",
    artists,
    album: albumData
      ? {
          id: albumData.uri ? uriToId(albumData.uri) : null,
          name: albumData.name ?? "",
        }
      : null,
    duration: durationMs > 0 ? formatDurationMs(durationMs) : null,
    durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : null,
    thumbnailURL: trackThumbnail,
    isExplicit,
  };
}

export async function handleLikedSongs(spDc: string): Promise<Response> {
  try {
    const data = await partnerQuery(spDc, OP.fetchLibraryTracks, {
      offset: 0,
      limit: 100,
    });

    const items = data?.data?.me?.library?.tracks?.items ?? [];
    const tracks = items.map((item: any) => parseLikedTrack(item)).filter(Boolean);
    const totalCount = data?.data?.me?.library?.tracks?.totalCount;
    const continuation = totalCount > tracks.length ? "100" : null;

    return json({
      id: "collection:tracks",
      title: "Liked Songs",
      author: null,
      description: null,
      trackCount: totalCount ? `${totalCount} songs` : `${tracks.length} songs`,
      thumbnailURL: "https://misc.scdn.co/liked-songs/liked-songs-640.png",
      tracks,
      continuation,
    });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("Liked songs error:", e.message);
    return errorResponse(e.message, 500);
  }
}

export async function handlePlaylist(spDc: string, playlistId: string): Promise<Response> {
  try {
    const data = await partnerQuery(spDc, OP.fetchPlaylist, {
      uri: `spotify:playlist:${playlistId}`,
      offset: 0,
      limit: 100,
      enableWatchFeedEntrypoint: false,
    });

    const playlist = data?.data?.playlistV2;
    if (!playlist) {
      return errorResponse("Playlist not found", 404);
    }

    const title = playlist.name ?? "";
    const description = playlist.description ?? null;
    const author = playlist.ownerV2?.data?.name ?? null;
    const thumbnailURL = bestImage(playlist.images?.items?.[0]?.sources ?? []);

    const contentItems = playlist.content?.items ?? [];
    const tracks = contentItems.map((item: any) => parsePlaylistTrack(item, thumbnailURL)).filter(Boolean);
    const totalCount = playlist.content?.totalCount;
    const continuation = totalCount > tracks.length ? "100" : null;

    return json({
      id: playlistId,
      title,
      author,
      description,
      trackCount: totalCount ? `${totalCount} songs` : tracks.length > 0 ? `${tracks.length} songs` : null,
      thumbnailURL,
      tracks,
      continuation,
    });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("Playlist error:", e.message);
    return errorResponse(e.message, 500);
  }
}

export async function handlePlaylistMore(spDc: string, playlistId: string, continuation: string): Promise<Response> {
  try {
    const offset = parseInt(continuation, 10);

    if (playlistId === "collection:tracks") {
      const data = await partnerQuery(spDc, OP.fetchLibraryTracks, { offset, limit: 100 });
      const items = data?.data?.me?.library?.tracks?.items ?? [];
      const totalCount = data?.data?.me?.library?.tracks?.totalCount ?? 0;
      const tracks = items.map((item: any) => parseLikedTrack(item)).filter(Boolean);
      const nextContinuation = offset + tracks.length < totalCount ? String(offset + 100) : null;
      return json({ tracks, continuation: nextContinuation });
    }

    const data = await partnerQuery(spDc, OP.fetchPlaylist, {
      uri: `spotify:playlist:${playlistId}`,
      offset,
      limit: 100,
      enableWatchFeedEntrypoint: false,
    });

    const contentItems = data?.data?.playlistV2?.content?.items ?? [];
    const totalCount = data?.data?.playlistV2?.content?.totalCount ?? 0;
    const tracks = contentItems.map((item: any) => parsePlaylistTrack(item, null)).filter(Boolean);
    const nextContinuation = offset + tracks.length < totalCount ? String(offset + 100) : null;

    return json({ tracks, continuation: nextContinuation });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("Playlist more error:", e.message);
    return errorResponse(e.message, 500);
  }
}

export async function handleAddToPlaylist(
  spDc: string,
  body: { videoId: string; playlistId: string },
): Promise<Response> {
  try {
    const { videoId, playlistId } = body;
    if (!videoId || !playlistId) {
      return errorResponse("Missing videoId or playlistId", 400);
    }

    const token = await getAccessToken(spDc);

    const res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [`spotify:track:${videoId}`] }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify API error (${res.status}): ${text.slice(0, 200)}`);
    }

    return json({ success: true });
  } catch (e: any) {
    if (isOnDeviceFetchSignal(e)) {
      throw e;
    }
    console.error("Add to playlist error:", e.message);
    return errorResponse(e.message, 500);
  }
}
