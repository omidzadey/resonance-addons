export { corsHeaders, errorResponse, json } from "@resonance-addons/shared";

import { parseConfig as decodeConfig } from "@resonance-addons/shared";

export const PROVIDER_ID = "com.resonance.am-lyrics-remote";

export interface AddonConfig {
  userToken: string;
}

export function parseConfig(configStr: string): AddonConfig {
  const config = decodeConfig<AddonConfig>(configStr);
  if (!config.userToken) throw new Error("Missing userToken in config");
  return config;
}
