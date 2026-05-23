/**
 * api/myuplink-token.js — Vercel Serverless Function
 *
 * Proxies MyUplink OAuth token requests so the clientSecret never
 * touches the browser. Deployed automatically by Vercel at:
 *   https://your-domain.vercel.app/api/myuplink-token
 *
 * Required environment variables (set in Vercel dashboard):
 *   MYUPLINK_CLIENT_ID      — your MyUplink OAuth client ID
 *   MYUPLINK_CLIENT_SECRET  — your MyUplink OAuth client secret (rotate first!)
 *
 * Supported grant types:
 *   authorization_code  — initial login (code → access + refresh tokens)
 *   refresh_token       — silent refresh before expiry
 */

const MYUPLINK_TOKEN_URL = 'https://api.myuplink.com/oauth/token';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate server config
  const clientId     = process.env.MYUPLINK_CLIENT_ID;
  const clientSecret = process.env.MYUPLINK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[myuplink-token] Missing MYUPLINK_CLIENT_ID or MYUPLINK_CLIENT_SECRET env vars');
    return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
  }

  const { grant_type, code, refresh_token, redirect_uri } = req.body || {};

  // Validate grant type
  if (!['authorization_code', 'refresh_token'].includes(grant_type)) {
    return res.status(400).json({ error: `Unsupported grant_type: ${grant_type}` });
  }

  // Require code for authorization_code grant
  if (grant_type === 'authorization_code' && !code) {
    return res.status(400).json({ error: 'Missing code for authorization_code grant' });
  }

  // Require refresh_token for refresh grant
  if (grant_type === 'refresh_token' && !refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token for refresh_token grant' });
  }

  // Build request to MyUplink token endpoint
  const body = new URLSearchParams({
    grant_type,
    client_id:     clientId,
    client_secret: clientSecret,
    ...(redirect_uri   && { redirect_uri }),
    ...(code           && { code }),
    ...(refresh_token  && { refresh_token }),
  });

  let upstream;
  try {
    upstream = await fetch(MYUPLINK_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });
  } catch (e) {
    console.error('[myuplink-token] Network error reaching MyUplink:', e);
    return res.status(502).json({ error: 'Could not reach MyUplink token endpoint' });
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    console.error('[myuplink-token] MyUplink rejected token request:', upstream.status, data);
    return res.status(upstream.status).json(data);
  }

  // Return tokens to browser — access_token is short-lived and safe to send
  return res.status(200).json(data);
}
