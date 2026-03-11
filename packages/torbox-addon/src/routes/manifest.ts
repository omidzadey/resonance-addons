import { json, PROVIDER_ID } from "../utils";

export function handleManifest(baseURL: string, configStr: string | null): Response {
  return json({
    id: PROVIDER_ID,
    name: "TorBox",
    description: "Stream music from cached torrents via TorBox",
    version: "1.0.0",
    icon: {
      type: "remote",
      value: "https://torbox.app/favicon.ico",
    },
    transport: { remote: configStr ? `${baseURL}/${configStr}` : baseURL },
    resources: [
      { type: "stream", idPrefixes: [PROVIDER_ID] },
      {
        type: "catalog",
        catalogs: [
          {
            id: "search",
            name: "Search",
            extra: [{ name: "search", isRequired: true }],
          },
        ],
      },
    ],
    auth: {
      type: "token",
      label: "Enter your TorBox API key from torbox.app/settings",
      fields: [
        {
          key: "apiKey",
          type: "password",
          title: "TorBox API Key",
          placeholder: "Paste your TorBox API key",
          isRequired: true,
        },
        {
          key: "allowUncached",
          type: "toggle",
          title: "Download uncached torrents",
          placeholder: "Queue uncached torrents so they are ready next time",
          isRequired: false,
        },
      ],
    },
    behaviorHints: { configurable: true, configurationRequired: true },
    capabilities: {
      supportsRadio: false,
      supportsQueueActions: false,
      supportsContinuation: false,
      supportsSearchSuggestions: false,
      supportsLikeStatus: false,
      supportsAddToPlaylist: false,
      supportsFilters: false,
      supportsQuickAccess: false,
      supportsRelated: false,
    },
  });
}
