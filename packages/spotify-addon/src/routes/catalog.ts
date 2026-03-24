import { getAccessToken, spotifyFetch } from "../auth";
import { errorResponse, isOnDeviceFetchSignal, json, PROVIDER_ID, uriToId } from "../utils";

export async function handleHome(spDc: string): Promise<Response> {
  try {
    const token = await getAccessToken(spDc);
    const res = await spotifyFetch(
      "https://spclient.wg.spotify.com/homeview/v1/home?market=US&platform=web&locale=en",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "app-platform": "WebPlayer",
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return errorResponse(`Home feed failed (${res.status})`, res.status);
    }

    const data = (await res.json()) as { body: any[] };
    const body = data?.body ?? [];

    const sections: {
      id: string;
      title: string;
      items: any[];
      style: "cards" | "quickPicks";
    }[] = [];

    let currentHeader: string | null = null;
    let currentItems: any[] = [];

    for (const item of body) {
      const componentId = item?.component?.id;

      if (componentId === "glue:sectionHeader") {
        if (currentHeader && currentItems.length > 0) {
          sections.push({
            id: crypto.randomUUID(),
            title: currentHeader,
            items: currentItems,
            style: "cards",
          });
        }
        currentHeader = item?.text?.title ?? "Untitled";
        currentItems = [];
        if (sections.length >= 6) break;
        continue;
      }

      if (componentId === "glue2:card" && currentHeader) {
        const parsed = parseCard(item);
        if (parsed) currentItems.push(parsed);
      }
    }

    if (currentHeader && currentItems.length > 0 && sections.length < 6) {
      sections.push({
        id: crypto.randomUUID(),
        title: currentHeader,
        items: currentItems,
        style: "cards",
      });
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
    console.error("Home feed error:", e.message);
    return errorResponse(e.message, 500);
  }
}

function parseCard(item: any): any | null {
  const title = item?.text?.title ?? "";
  const subtitle = item?.text?.subtitle ?? "";
  const thumbnailURL = item?.images?.main?.uri ?? null;
  const targetUri: string | undefined = item?.target?.uri;

  if (!targetUri) return null;

  if (targetUri.startsWith("spotify:playlist:")) {
    return {
      type: "playlist",
      playlist: {
        id: uriToId(targetUri),
        provider: PROVIDER_ID,
        title,
        author: subtitle || null,
        trackCount: null,
        thumbnailURL,
      },
    };
  }

  if (targetUri.startsWith("spotify:album:")) {
    return {
      type: "album",
      album: {
        id: uriToId(targetUri),
        provider: PROVIDER_ID,
        title,
        artists: [{ id: null, name: subtitle }],
        year: null,
        thumbnailURL,
        isExplicit: false,
      },
    };
  }

  if (targetUri.startsWith("spotify:artist:")) {
    return {
      type: "artist",
      artist: {
        id: uriToId(targetUri),
        provider: PROVIDER_ID,
        name: title,
        thumbnailURL,
        subscriberCount: null,
      },
    };
  }

  return null;
}
