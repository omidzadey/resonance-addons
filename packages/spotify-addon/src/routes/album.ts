import { OP, partnerQuery } from "../partner";
import { bestImage, errorResponse, formatDurationMs, json, PROVIDER_ID, uriToId } from "../utils";

export async function handleAlbum(spDc: string, albumId: string): Promise<Response> {
  try {
    const data = await partnerQuery(spDc, OP.getAlbum, {
      uri: `spotify:album:${albumId}`,
      locale: "",
      offset: 0,
      limit: 50,
    });

    const album = data?.data?.albumUnion;
    if (!album) {
      return errorResponse("Album not found", 404);
    }

    const albumTitle = album.name ?? "";
    const albumArtists: { id: string | null; name: string }[] = (album.artists?.items ?? []).map((a: any) => ({
      id: a.uri ? uriToId(a.uri) : null,
      name: a.profile?.name ?? "",
    }));
    const isoDate: string | undefined = album.date?.isoString;
    const year = isoDate ? isoDate.slice(0, 4) : null;
    const thumbnailURL = bestImage(album.coverArt?.sources ?? []);

    const trackItems = album.tracksV2?.items ?? [];
    const tracks = trackItems
      .filter((item: any) => item.track)
      .map((item: any) => {
        const t = item.track;
        const trackUri: string = t.uri ?? "";
        const durationMs = t.duration?.totalMilliseconds ?? 0;
        const artists = (t.artists?.items ?? []).map((a: any) => ({
          id: a.uri ? uriToId(a.uri) : null,
          name: a.profile?.name ?? "",
        }));
        const isExplicit = t.contentRating?.label === "EXPLICIT" || t.contentRating?.label === "explicit";

        return {
          id: uriToId(trackUri),
          provider: PROVIDER_ID,
          title: t.name ?? "",
          artists,
          album: { id: albumId, name: albumTitle },
          duration: durationMs > 0 ? formatDurationMs(durationMs) : null,
          durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : null,
          thumbnailURL,
          isExplicit,
        };
      });

    return json({
      id: albumId,
      title: albumTitle,
      artists: albumArtists,
      year,
      trackCount: tracks.length > 0 ? `${tracks.length} songs` : null,
      duration: null,
      thumbnailURL,
      tracks,
      playlistId: albumId,
    });
  } catch (e: any) {
    console.error("Album error:", e.message);
    return errorResponse(e.message, 500);
  }
}
