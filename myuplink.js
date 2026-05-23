/**
 * myuplink.js — MyUplink OAuth2 + API layer for Yvirvaking
 *
 * Usage:
 *   MyUplink.login()            — redirect to MyUplink login page
 *   MyUplink.logout()           — clear tokens
 *   MyUplink.isAuthenticated()  — true/false
 *   MyUplink.getSystems()       — returns [{systemId, name, devices:[]}]
 *   MyUplink.getPoints(deviceId)— returns array of data points
 *   MyUplink.setPoint(deviceId, parameterId, value) — write a setpoint
 *   MyUplink.getAlarms(systemId)— returns active alarms
 *   MyUplink.onAuthChange(fn)   — register callback for auth state changes
 *
 * Call MyUplink.init() once on page load. It handles:
 *   - Detecting the OAuth callback (?code=)
 *   - Silently refreshing tokens before expiry
 */

const MyUplink = (() => {
  const STORAGE_KEY = 'yvirvaking_myuplink_tokens';
  const authChangeListeners = [];
  let _refreshTimer = null;

  // ─── State helpers ───────────────────────────────────────────────────────────

  function randomBytes(n) {
    const arr = new Uint8Array(n);
    crypto.getRandomValues(arr);
    return arr;
  }

  function base64url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // ─── Token storage ──────────────────────────────────────────────────────────

  function saveTokens(tokens) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...tokens,
      stored_at: Date.now()
    }));
    scheduleRefresh(tokens.expires_in);
    authChangeListeners.forEach(fn => fn(true));
  }

  function loadTokens() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  }

  function clearTokens() {
    localStorage.removeItem(STORAGE_KEY);
    if (_refreshTimer) clearTimeout(_refreshTimer);
    authChangeListeners.forEach(fn => fn(false));
  }

  function scheduleRefresh(expiresIn) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    const ms = ((expiresIn || 3600) - 60) * 1000; // refresh 60s before expiry
    _refreshTimer = setTimeout(refreshTokens, Math.max(ms, 5000));
  }

  // ─── OAuth flow ─────────────────────────────────────────────────────────────

  async function login() {
    const cfg   = window.YVIRVAKING_CONFIG.myuplink;
    const state = base64url(randomBytes(16));

    sessionStorage.setItem('myuplink_oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     cfg.clientId,
      redirect_uri:  cfg.redirectUri,
      scope:         cfg.scopes,
      state,
    });

    window.location.href = cfg.authUrl + '?' + params.toString();
  }

  async function handleCallback() {
    const cfg = window.YVIRVAKING_CONFIG.myuplink;
    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const state = params.get('state');

    if (!code) return false;

    const savedState = sessionStorage.getItem('myuplink_oauth_state');
    sessionStorage.removeItem('myuplink_oauth_state');

    if (state !== savedState) {
      console.error('MyUplink OAuth: state mismatch — possible CSRF');
      return false;
    }

    // Token exchange goes through our server-side proxy so clientSecret
    // never touches the browser. See /api/myuplink-token.js
    const res = await fetch('/api/myuplink-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:   'authorization_code',
        code,
        redirect_uri: cfg.redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('MyUplink token exchange failed:', err);
      return false;
    }

    const tokens = await res.json();
    saveTokens(tokens);

    // Clean the code/state from the URL without a page reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    return true;
  }

  async function refreshTokens() {
    const cfg    = window.YVIRVAKING_CONFIG.myuplink;
    const stored = loadTokens();
    if (!stored?.refresh_token) { clearTokens(); return; }

    const res = await fetch('/api/myuplink-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'refresh_token',
        refresh_token: stored.refresh_token,
      }),
    });

    if (!res.ok) { clearTokens(); return; }
    const tokens = await res.json();
    saveTokens({ ...stored, ...tokens });
  }

  function logout() {
    clearTokens();
  }

  function isAuthenticated() {
    const t = loadTokens();
    if (!t?.access_token) return false;
    const age = (Date.now() - (t.stored_at || 0)) / 1000;
    return age < (t.expires_in || 3600);
  }

  function getAccessToken() {
    return loadTokens()?.access_token || null;
  }

  // ─── API helper ─────────────────────────────────────────────────────────────

  async function apiFetch(path, options = {}) {
    const cfg   = window.YVIRVAKING_CONFIG.myuplink;
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(cfg.apiBase + path, {
      ...options,
      headers: {
        'Authorization':   'Bearer ' + token,
        'Content-Type':    'application/json',
        'Accept-Language': 'en-US',
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      // Token expired mid-session — try one refresh then retry
      await refreshTokens();
      const newToken = getAccessToken();
      if (!newToken) throw new Error('Session expired. Please log in again.');
      const retry = await fetch(cfg.apiBase + path, {
        ...options,
        headers: { 'Authorization': 'Bearer ' + newToken, 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      if (!retry.ok) throw new Error(`API error ${retry.status}`);
      return retry.json();
    }

    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // ─── Public API endpoints ───────────────────────────────────────────────────

  async function getSystems() {
    const data = await apiFetch('/systems/me');
    console.log('[YV] /systems/me raw:', data);
    // Devices are embedded inside each system object
    return data.systems || data || [];
  }

  async function getPoints(deviceId) {
    const data = await apiFetch(`/devices/${deviceId}/points`);
    return data.parameterGroups || data || [];
  }

  async function setPoint(deviceId, parameterId, value) {
    return apiFetch(`/devices/${deviceId}/points`, {
      method: 'PATCH',
      body: JSON.stringify([{ parameterId, value }]),
    });
  }

  async function getAlarms(systemId) {
    const data = await apiFetch(`/systems/${systemId}/notifications/active`);
    return data.notifications || data || [];
  }

  // Fetch everything for all systems and return a normalised fleet array
  async function getFleet() {
    const systems = await getSystems();
    const fleet = [];

    await Promise.all(systems.map(async (sys) => {
      // Devices are embedded in the system object — no separate endpoint needed
      const devices = sys.devices || [];
      console.log(`[YV] System "${sys.name}" has ${devices.length} device(s):`, devices);

      await Promise.all(devices.map(async (dev) => {
        const groups  = await getPoints(dev.id);
        const alarms  = await getAlarms(sys.systemId).catch(() => []);

        // Flatten all parameter groups into a single lookup map
        const points = {};
        (groups || []).forEach(g => {
          (g.parameters || []).forEach(p => { points[p.parameterId] = p; });
        });

        fleet.push({
          id:        dev.id,
          systemId:  sys.systemId,
          name:      sys.name || dev.product?.name || 'Heat Pump',
          serial:    dev.product?.serialNumber || dev.id,
          model:     dev.product?.name || 'CTC',
          address:   sys.address || '',
          points,
          alarms,
          hasAlarm:  alarms.some(a => a.severity === 'Error'),
          hasWarn:   alarms.some(a => a.severity === 'Warning'),
          // Common readings with fallback to null
          outdoorTemp:  points[10001]?.value ?? null,
          supplyTemp:   points[10002]?.value ?? null,
          returnTemp:   points[10003]?.value ?? null,
          hotWaterTemp: points[10006]?.value ?? null,
          roomTemp:     points[10012]?.value ?? null,
          setpoint:     points[47011]?.value ?? null,
          cop:          points[40940]?.value ?? null,
          mode:         points[49993]?.value ?? null,
        });
      }));
    }));

    return fleet;
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  async function init() {
    // Handle OAuth callback
    if (window.location.search.includes('code=')) {
      await handleCallback();
    }

    // Schedule refresh if already authenticated
    const stored = loadTokens();
    if (stored?.refresh_token) {
      const age = (Date.now() - (stored.stored_at || 0)) / 1000;
      const remaining = (stored.expires_in || 3600) - age;
      if (remaining < 60) {
        await refreshTokens();
      } else {
        scheduleRefresh(remaining);
      }
    }
  }

  function onAuthChange(fn) {
    authChangeListeners.push(fn);
  }

  // ─── Public interface ────────────────────────────────────────────────────────
  return {
    init,
    login,
    logout,
    isAuthenticated,
    onAuthChange,
    getSystems,
    getPoints,
    setPoint,
    getAlarms,
    getFleet,
  };
})();

window.MyUplink = MyUplink;
