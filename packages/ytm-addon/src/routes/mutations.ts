import { ytFetch } from "../auth";
import { errorResponse, json } from "../utils";

export async function handleLike(
  refreshToken: string,
  body: { videoId: string; status: "liked" | "disliked" | "none" },
): Promise<Response> {
  try {
    const { videoId, status } = body;
    if (!videoId) return errorResponse("Missing videoId", 400);

    const endpointMap: Record<string, string> = {
      liked: "like/like",
      disliked: "like/dislike",
      none: "like/removelike",
    };

    const endpoint = endpointMap[status];
    if (!endpoint) return errorResponse("Invalid status", 400);

    await ytFetch(endpoint, refreshToken, { target: { videoId } });
    return json({ success: true });
  } catch (e: any) {
    console.error("Like error:", e.message);
    return errorResponse(e.message, 500);
  }
}

export async function handleAddToPlaylist(
  refreshToken: string,
  body: { videoId: string; playlistId: string },
): Promise<Response> {
  try {
    const { videoId, playlistId: rawPlaylistId } = body;
    if (!videoId || !rawPlaylistId) {
      return errorResponse("Missing videoId or playlistId", 400);
    }

    const playlistId = rawPlaylistId.startsWith("VL") ? rawPlaylistId.slice(2) : rawPlaylistId;

    await ytFetch("browse/edit_playlist", refreshToken, {
      playlistId,
      actions: [{ action: "ACTION_ADD_VIDEO", addedVideoId: videoId }],
    });

    return json({ success: true });
  } catch (e: any) {
    console.error("Add to playlist error:", e.message);
    return errorResponse(e.message, 500);
  }
}
