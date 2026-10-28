// Bing Webmaster API relay (Google Apps Script web app).
// Bing blocks Cloudflare Workers' IPs (ThrottleIP), so the Worker sends its calls here
// and this script makes them from Google's network.

const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json/';

// Run once from the editor: creates the shared secret and asks for the fetch permission.
// The secret is not logged; copy it from Project Settings → Script Properties.
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RELAY_SECRET')) {
    props.setProperty('RELAY_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  // Without a token Bing should answer InvalidApiKey. ThrottleIP here means Google is blocked too.
  const probe = UrlFetchApp.fetch(BING_API + 'GetUserSites', { muteHttpExceptions: true });
  Logger.log('Bing: HTTP ' + probe.getResponseCode() + ' ' + probe.getContentText().slice(0, 200));
}

// Body: { secret, token, method, httpMethod: "GET" | "POST", params?, body? }
function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return refuse('invalid json');
  }

  const secret = (PropertiesService.getScriptProperties().getProperty('RELAY_SECRET') || '').trim();
  if (!secret || typeof req.secret !== 'string' || !safeEqual(req.secret.trim(), secret)) return refuse('forbidden');
  // Only Bing method names, so the relay can't be pointed anywhere else.
  if (!/^[A-Za-z]+$/.test(req.method || '')) return refuse('bad method');
  if (req.httpMethod !== 'GET' && req.httpMethod !== 'POST') return refuse('bad httpMethod');
  if (typeof req.token !== 'string' || !req.token) return refuse('missing token');

  const params = req.params || {};
  const query = Object.keys(params)
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])); })
    .join('&');

  const options = {
    method: req.httpMethod.toLowerCase(),
    headers: { Authorization: 'Bearer ' + req.token },
    muteHttpExceptions: true,
    followRedirects: false,
  };
  if (req.httpMethod === 'POST') {
    options.contentType = 'application/json; charset=utf-8';
    options.payload = JSON.stringify(req.body || {});
  }

  const res = UrlFetchApp.fetch(BING_API + req.method + (query ? '?' + query : ''), options);
  return reply(res.getResponseCode(), res.getContentText());
}

// Constant-time compare, so the secret can't be guessed from response times.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Apps Script can't set a status code, so Bing's status travels in the body.
function reply(status, body) {
  return json({ status: status, body: body });
}

// The relay's own errors, kept apart from Bing's.
function refuse(reason) {
  return json({ relayError: reason });
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
