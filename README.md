# bing-webmaster-workers-relay

Use the Bing Webmaster API from Cloudflare Workers.

## Why

Bing answers every Webmaster API call from Cloudflare Workers with:

```
HTTP 400 {"ErrorCode":17,"Message":"ERROR!!! ThrottleIP"}
```

It throttles Cloudflare's shared egress IPs, not your account: the same token works from any other network, retries don't help, and the block lasts for days. The OAuth token endpoint is not affected.

This repo moves only the API calls to a small Google Apps Script web app, which makes them from Google's network. Free, no server.

```
Worker ──(secret + access token)──▶ Apps Script ──▶ ssl.bing.com/webmaster/api.svc/json
```

## Setup

1. Create a project at [script.google.com](https://script.google.com) and paste [`relay/Code.gs`](relay/Code.gs).
2. Run `setup` once. The log should show `InvalidApiKey` (good), not `ThrottleIP`.
3. **Deploy → New deployment → Web app**, execute as *Me*, access *Anyone*. Keep the `/exec` URL.
4. Copy `RELAY_SECRET` from **Project Settings → Script Properties** into your Worker as a secret.
5. Call Bing with [`client/bing-fetch.ts`](client/bing-fetch.ts).

After editing the script, use **Manage deployments → Edit → New version**. Otherwise the `/exec` URL keeps running the old code.

## Security

- Only Bing Webmaster API methods can be called. The relay can't reach anything else.
- The secret only keeps strangers off your quota. Calls still need your own Bing access token.
- Keep OAuth and token refresh in the Worker, so the relay only sees short-lived access tokens.

Meant for your own sites at normal volume, not bulk crawling.

## License

MIT
