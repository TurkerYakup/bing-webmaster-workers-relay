// Calls the Bing Webmaster API through the Apps Script relay (relay/Code.gs).
// Works in Cloudflare Workers or any runtime with fetch.

export interface RelayConfig {
  relayUrl: string; // the web app's /exec URL
  relaySecret: string; // the script's RELAY_SECRET
}

export type BingParams = Record<string, string | number | boolean>;

// GET when there is no body, POST otherwise. Returns Bing's `d` value.
export async function bingFetch(
  config: RelayConfig,
  token: string,
  method: string,
  init: { params?: BingParams; body?: unknown } = {},
): Promise<unknown> {
  // Apps Script answers with a 302; fetch follows it as a GET, which is what it expects.
  const res = await fetch(config.relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: config.relaySecret.trim(),
      token,
      method,
      httpMethod: init.body === undefined ? "GET" : "POST",
      params: init.params ?? {},
      body: init.body,
    }),
  });

  const relayed = (await res.json().catch(() => null)) as
    | { status?: number; body?: string; relayError?: string }
    | null;
  if (!relayed || relayed.relayError || typeof relayed.status !== "number") {
    throw new Error(`Relay refused the request (${relayed?.relayError ?? `HTTP ${res.status}`})`);
  }

  // Bing errors look like {"ErrorCode": 14, "Message": "..."}.
  let parsed: { d?: unknown; Message?: string } | null = null;
  try {
    parsed = relayed.body ? JSON.parse(relayed.body) : null;
  } catch {
    // Not JSON (an HTML error page); the status says enough.
  }
  if (relayed.status >= 400) {
    throw new Error(`Bing ${method} failed (HTTP ${relayed.status}): ${parsed?.Message ?? "no message"}`);
  }
  return parsed?.d ?? null;
}

// Example:
//   const sites = await bingFetch(config, accessToken, "GetUserSites");
//   await bingFetch(config, accessToken, "SubmitUrlBatch", {
//     body: { siteUrl: "https://example.com/", urlList: ["https://example.com/new"] },
//   });
