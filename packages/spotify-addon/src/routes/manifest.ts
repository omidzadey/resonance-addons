import { json, PROVIDER_ID } from "../utils";

export function handleManifest(baseURL: string, configStr: string | null): Response {
  return json({
    id: PROVIDER_ID,
    name: "Spotify",
    description: "Lyrics, metadata, and DJ from your Spotify account",
    version: "1.0.0",
    icon: {
      type: "remote",
      value: "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png",
    },
    transport: { remote: configStr ? `${baseURL}/${configStr}` : baseURL },
    resources: [
      {
        type: "catalog",
        catalogs: [
          { id: "home", name: "Home", isDefault: true },
          { id: "library", name: "Library" },
          { id: "search", name: "Search", extra: [{ name: "search", isRequired: true }] },
        ],
      },
      { type: "lyrics", syncTypes: ["wordSynced", "lineSynced"] },
      { type: "tts" },
      { type: "metadata" },
    ],
    auth: {
      type: "token",
      label: "Enter your sp_dc cookie. See /configure for instructions.",
      fields: [
        {
          key: "spDc",
          type: "password",
          title: "sp_dc Cookie",
          placeholder: "Paste your sp_dc cookie value",
          isRequired: true,
        },
      ],
    },
    behaviorHints: { configurable: true, configurationRequired: true },
    capabilities: {
      supportsRadio: false,
      supportsQueueActions: false,
      supportsContinuation: true,
      supportsSearchSuggestions: true,
      supportsLikeStatus: false,
      supportsAddToPlaylist: true,
      supportsFilters: false,
      supportsQuickAccess: false,
      supportsRelated: false,
    },
  });
}
