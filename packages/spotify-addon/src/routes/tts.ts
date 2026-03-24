import { getAccessToken, spotifyFetch } from "../auth";
import { corsHeaders } from "../utils";

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

function encodeTag(fieldNumber: number, wireType: number): number[] {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeString(fieldNumber: number, value: string): number[] {
  const encoded = new TextEncoder().encode(value);
  return [...encodeTag(fieldNumber, 2), ...encodeVarint(encoded.length), ...Array.from(encoded)];
}

function encodeVarintField(fieldNumber: number, value: number): number[] {
  return [...encodeTag(fieldNumber, 0), ...encodeVarint(value)];
}

export async function handleTTS(spDc: string, req: Request): Promise<Response> {
  const body = (await req.json()) as { text: string; voiceId?: string };
  const { text, voiceId } = body;

  const token = await getAccessToken(spDc);

  const ssml = `<speak xml:lang="en-US">${text}</speak>`;

  const proto = new Uint8Array([
    ...encodeString(2, ssml),
    ...encodeVarintField(3, 5),
    ...encodeString(4, "en-US"),
    ...encodeVarintField(5, voiceId ? parseInt(voiceId, 10) : 1),
    ...encodeVarintField(6, 6),
    ...encodeVarintField(7, 44100),
  ]);

  const res = await spotifyFetch(
    "https://spclient.wg.spotify.com/client-tts/v1/fulfill",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: proto,
    },
    { cacheable: true },
  );

  if (res.status === 303) {
    const location = res.headers.get("Location");
    if (!location) {
      return new Response("Missing redirect location", { status: 502, headers: corsHeaders() });
    }
    const audioRes = await spotifyFetch(location, {}, { cacheable: false });
    const audioData = await audioRes.arrayBuffer();
    return new Response(audioData, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...corsHeaders(),
      },
    });
  }

  if (res.ok) {
    const audioData = await res.arrayBuffer();
    return new Response(audioData, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...corsHeaders(),
      },
    });
  }

  return new Response("TTS request failed", { status: res.status, headers: corsHeaders() });
}
