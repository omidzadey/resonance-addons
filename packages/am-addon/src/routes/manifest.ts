import { json, PROVIDER_ID } from "../utils";

export function handleManifest(baseURL: string, configStr: string | null): Response {
  return json({
    id: PROVIDER_ID,
    name: "Apple Music Enhancements",
    description: "Lyrics, metadata, and artwork from Apple Music",
    version: "1.0.0",
    icon: {
      type: "bundled",
      value: "applemusic",
    },
    transport: { remote: configStr ? `${baseURL}/${configStr}` : baseURL },
    resources: [{ type: "lyrics", syncTypes: ["wordSynced", "lineSynced"] }, { type: "metadata" }],
    auth: {
      type: "token",
      label: "Enter your Media User Token. See /configure for instructions.",
      fields: [
        {
          key: "userToken",
          type: "password",
          title: "Media User Token",
          placeholder: "Paste your Media User Token here",
          isRequired: true,
        },
      ],
    },
    behaviorHints: { configurable: true, configurationRequired: true },
  });
}
