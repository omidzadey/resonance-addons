export { corsHeaders, errorResponse, formatDuration, json } from "@resonance-addons/shared";

import { parseConfig as decodeConfig } from "@resonance-addons/shared";

export const PROVIDER_ID = "com.resonance.torbox";

export interface AddonConfig {
  apiKey: string;
  allowUncached?: boolean;
}

export function parseConfig(configStr: string): AddonConfig {
  const config = decodeConfig<AddonConfig>(configStr);
  if (!config.apiKey) throw new Error("Missing apiKey in config");
  if (typeof config.allowUncached === "string") {
    config.allowUncached = config.allowUncached === "true";
  }
  return config;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
