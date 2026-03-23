import { createHmac } from "node:crypto";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const tokenCache = new Map<string, { token: string; expires: number }>();
const pendingTokens = new Map<string, Promise<string>>();

let cachedSecret: { secret: Buffer; version: number; expiresAt: number } | null = null;
let pendingSecret: Promise<{ secret: Buffer; version: number }> | null = null;

export async function scrapeSecret(): Promise<{ secret: Buffer; version: number }> {
  if (cachedSecret && Date.now() < cachedSecret.expiresAt) {
    return cachedSecret;
  }

  if (pendingSecret) return pendingSecret;

  const promise = (async () => {
    const html = await fetch("https://open.spotify.com/", {
      headers: { "User-Agent": USER_AGENT },
    }).then((r) => r.text());

    const jsMatch = html.match(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[a-f0-9]+\.js/);
    if (!jsMatch) throw new Error("Could not find web player JS bundle URL");

    const js = await fetch(jsMatch[0], {
      headers: { "User-Agent": USER_AGENT },
    }).then((r) => r.text());

    const entryMatch = js.match(/\{secret:(['"])((?:(?!\1).|\\.)*?)\1,version:(\d+)\}/);
    if (!entryMatch) throw new Error("Could not find TOTP secret in JS bundle");

    const rawSecret = entryMatch[2]!;
    const version = parseInt(entryMatch[3]!, 10);

    const transformed: number[] = rawSecret.split("").map((ch, i) => ch.charCodeAt(0) ^ ((i % 33) + 9));
    const hexStr = Buffer.from(transformed.join(""), "utf8").toString("hex");
    const secret = Buffer.from(hexStr, "hex");

    cachedSecret = { secret, version, expiresAt: Date.now() + 3600_000 };
    console.log(`[auth] Scraped TOTP secret (version ${version}, ${secret.length} bytes)`);
    return { secret, version };
  })();

  pendingSecret = promise;
  promise.finally(() => {
    pendingSecret = null;
  });
  return promise;
}

function generateTOTP(secret: Buffer, timestampSec: number): string {
  const period = 30;
  const digits = 6;
  const counter = Math.floor(timestampSec / period);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

export async function getAccessToken(spDc: string): Promise<string> {
  const cached = tokenCache.get(spDc);
  if (cached && Date.now() < cached.expires) {
    return cached.token;
  }

  const pending = pendingTokens.get(spDc);
  if (pending) return pending;

  const promise = (async () => {
    const { secret, version } = await scrapeSecret();

    const serverTimeRes = await fetch("https://open.spotify.com/", {
      headers: {
        Cookie: `sp_dc=${spDc}`,
        "User-Agent": USER_AGENT,
      },
    });
    const pageHtml = await serverTimeRes.text();
    const configMatch = pageHtml.match(/<script id="appServerConfig" type="text\/plain">([^<]+)<\/script>/);
    let serverTime = Math.floor(Date.now() / 1000);
    if (configMatch) {
      try {
        const config = JSON.parse(Buffer.from(configMatch[1]!, "base64").toString("utf8"));
        if (config.serverTime) serverTime = config.serverTime;
      } catch {}
    }

    const totp = generateTOTP(secret, serverTime);
    const totpServer = generateTOTP(secret, serverTime);

    const params = new URLSearchParams({
      reason: "transport",
      productType: "web-player",
      totp,
      totpServer,
      totpVer: String(version),
    });

    const res = await fetch(`https://open.spotify.com/api/token?${params.toString()}`, {
      headers: {
        Cookie: `sp_dc=${spDc}`,
        "User-Agent": USER_AGENT,
      },
      redirect: "manual",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      accessToken: string;
      accessTokenExpirationTimestampMs: number;
      isAnonymous?: boolean;
    };

    if (data.isAnonymous) {
      throw new Error("sp_dc cookie is invalid or expired — reconnect in addon settings");
    }

    tokenCache.set(spDc, {
      token: data.accessToken,
      expires: data.accessTokenExpirationTimestampMs - 60_000,
    });

    console.log("[auth] Token acquired, expires:", new Date(data.accessTokenExpirationTimestampMs).toISOString());
    return data.accessToken;
  })();

  pendingTokens.set(spDc, promise);
  promise.finally(() => {
    pendingTokens.delete(spDc);
  });
  return promise;
}
