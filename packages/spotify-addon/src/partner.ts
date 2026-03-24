import { getAccessToken, spotifyFetch } from "./auth";

const APP_VERSION = "1.2.85.84.g58d1df8c";
const CLIENT_ID = "d8a5ed958d274c2e8ee717e6a4b0971d";

export const OP = {
  getAlbum: {
    name: "getAlbum",
    hash: "b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10",
  },
  fetchPlaylist: {
    name: "fetchPlaylist",
    hash: "9c53fb83f35c6a177be88bf1b67cb080b853e86b576ed174216faa8f9164fc8f",
  },
  getTrack: {
    name: "getTrack",
    hash: "612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294",
  },
  libraryV3: {
    name: "libraryV3",
    hash: "9f4da031f81274d572cfedaf6fc57a737c84b43d572952200b2c36aaa8fec1c6",
  },
  fetchLibraryTracks: {
    name: "fetchLibraryTracks",
    hash: "087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240",
  },
} as const;

let clientTokenCache: { token: string; expires: number } | null = null;
const deviceId = crypto.randomUUID();
let pendingClientToken: Promise<string> | null = null;

export async function prewarmClientToken(): Promise<void> {
  await getClientToken();
}

async function getClientToken(): Promise<string> {
  if (clientTokenCache && Date.now() < clientTokenCache.expires) {
    return clientTokenCache.token;
  }

  if (pendingClientToken) return pendingClientToken;

  const promise = (async () => {
    const res = await spotifyFetch(
      "https://clienttoken.spotify.com/v1/clienttoken",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_data: {
            client_version: APP_VERSION,
            client_id: CLIENT_ID,
            js_sdk_data: {
              device_brand: "Apple",
              device_model: "unknown",
              os: "macos",
              os_version: "10.15.7",
              device_id: deviceId,
              device_type: "computer",
            },
          },
        }),
      },
      { cacheable: true },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Client token exchange failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    const token = data.granted_token.token;
    const expiresInSec = data.granted_token.expires_after_seconds ?? 7200;

    clientTokenCache = {
      token,
      expires: Date.now() + (expiresInSec - 60) * 1000,
    };

    console.log("[partner] Client token acquired");
    return token;
  })();

  pendingClientToken = promise;
  void promise
    .finally(() => {
      pendingClientToken = null;
    })
    .catch(() => {});
  return promise;
}

export async function partnerQuery(
  spDc: string,
  op: { name: string; hash: string },
  variables: Record<string, any>,
): Promise<any> {
  const [accessToken, clientToken] = await Promise.all([getAccessToken(spDc), getClientToken()]);

  const res = await spotifyFetch(
    "https://api-partner.spotify.com/pathfinder/v2/query",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "client-token": clientToken,
        "app-platform": "WebPlayer",
        "spotify-app-version": APP_VERSION,
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json",
        Origin: "https://open.spotify.com",
        Referer: "https://open.spotify.com/",
      },
      body: JSON.stringify({
        operationName: op.name,
        variables,
        extensions: {
          persistedQuery: { version: 1, sha256Hash: op.hash },
        },
      }),
    },
    { cacheable: true },
  );

  const data = (await res.json()) as any;
  if (res.status !== 200) {
    throw new Error(`api-partner ${op.name} failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}
