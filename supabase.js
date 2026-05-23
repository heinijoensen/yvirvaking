// Yvirvaking — Supabase auth + data helpers
(function() {
  const cfg = window.YVIRVAKING_CONFIG?.supabase;
  if (!cfg || !window.supabase) { console.warn('[YV] Supabase not configured'); return; }

  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  window.YV_SB = sb;

  // ── Sign-out pill ──────────────────────────────────────────────────────────
  function injectSignOutPill(user) {
    if (document.getElementById('yv-signout-pill')) return;
    const name = user?.profile?.name || user?.email || 'User';
    const role = user?.profile?.role || '';
    const roleColor = { admin: '#e8a020', installer: '#2176ae', customer: '#1e9e5e' }[role] || '#7f9ab5';
    const pill = document.createElement('div');
    pill.id = 'yv-signout-pill';
    pill.innerHTML = `
      <style>
        #yv-signout-pill {
          position: fixed; bottom: 16px; right: 16px; z-index: 8888;
          display: flex; align-items: center; gap: 10px;
          background: rgba(13,21,32,0.92); border: 1px solid rgba(42,63,88,0.9);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-radius: 999px; padding: 7px 14px 7px 10px;
          font-family: 'Outfit', sans-serif; font-size: 12px; color: #7f9ab5;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          cursor: default; user-select: none;
        }
        #yv-signout-pill .yv-pill-avatar {
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(192,57,43,0.2); border: 1px solid rgba(192,57,43,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; color: #c0392b; flex-shrink: 0;
        }
        #yv-signout-pill .yv-pill-name { color: #eef2f7; font-weight: 500; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #yv-signout-pill .yv-pill-role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        #yv-signout-pill .yv-pill-sep { width: 1px; height: 22px; background: rgba(42,63,88,0.8); }
        #yv-signout-pill .yv-pill-out {
          background: none; border: none; color: #7f9ab5; font-family: inherit;
          font-size: 11px; cursor: pointer; padding: 2px 4px; border-radius: 4px;
          display: flex; align-items: center; gap: 5px; transition: color 0.15s;
          white-space: nowrap;
        }
        #yv-signout-pill .yv-pill-out:hover { color: #c0392b; }
        #yv-signout-pill .yv-pill-out svg { flex-shrink: 0; }
      </style>
      <div class="yv-pill-avatar">${name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="yv-pill-name">${name}</div>
        <div class="yv-pill-role" style="color:${roleColor}">${role}</div>
      </div>
      <div class="yv-pill-sep"></div>
      <button class="yv-pill-out" onclick="YV_AUTH.signOut()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign out
      </button>
    `;
    document.body.appendChild(pill);
  }

  // ── Auth helpers ───────────────────────────────────────────────────────────
  window.YV_AUTH = {
    async getSession() {
      const { data: { session } } = await sb.auth.getSession();
      return session;
    },

    async getUser() {
      try {
        const { data: { user }, error: authErr } = await sb.auth.getUser();
        if (authErr) { console.error('[YV] getUser auth error:', authErr.message); return null; }
        if (!user) return null;

        const { data: profile, error: profileErr } = await sb.from('profiles')
          .select('*').eq('id', user.id).single();

        if (profileErr) {
          // Common case: profiles table doesn't exist yet (schema not run)
          console.error('[YV] Profile fetch error:', profileErr.message);
          console.error('[YV] Have you run SCHEMA.sql in Supabase? Go to: supabase.com → SQL Editor → run SCHEMA.sql');
          // Return user with no role so requireRole can handle it gracefully
          return { ...user, profile: null };
        }

        if (!profile) {
          console.warn('[YV] No profile row found for user:', user.email, '— trigger may not have fired');
        } else {
          console.info('[YV] Authenticated:', profile.name, '| role:', profile.role);
        }

        return { ...user, profile: profile || { role: 'customer' } };
      } catch (e) {
        console.error('[YV] getUser exception:', e.message);
        return null;
      }
    },

    async requireRole(...roles) {
      try {
        const user = await this.getUser();
        if (!user) {
          console.warn('[YV] requireRole: no user → redirecting to login');
          window.location.replace('login.html');
          return null;
        }

        if (!user.profile) {
          // Profile table missing — show helpful error instead of silent wrong redirect
          console.error('[YV] requireRole: profile is null. Schema not run or trigger failed.');
          const gate = document.getElementById('auth-gate');
          if (gate) gate.innerHTML = `
            <div style="text-align:center;padding:32px;font-family:Outfit,sans-serif;max-width:440px">
              <div style="font-size:32px;margin-bottom:16px">⚠️</div>
              <div style="color:#eef2f7;font-size:16px;font-weight:600;margin-bottom:10px">Database not set up</div>
              <div style="color:#7f9ab5;font-size:13px;line-height:1.6;margin-bottom:20px">
                The <code style="background:#132030;padding:2px 6px;border-radius:4px">profiles</code> table is missing.<br>
                Run <strong>SCHEMA.sql</strong> in your Supabase SQL Editor, then reload.
              </div>
              <button onclick="YV_AUTH.signOut()" style="background:#c0392b;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-family:Outfit,sans-serif;font-size:13px;cursor:pointer">Sign out</button>
            </div>`;
          return null;
        }

        const role = user.profile?.role;
        if (!roles.includes(role)) {
          console.warn('[YV] requireRole: role', role, 'not in', roles, '→ redirecting');
          const map = { admin: 'index.html', installer: 'Tier25%20Field%20App.html', customer: 'Tier3%20App.html' };
          window.location.replace(map[role] || 'login.html');
          return null;
        }

        injectSignOutPill(user);
        return user;
      } catch (e) {
        console.error('[YV] requireRole exception:', e.message);
        window.location.replace('login.html');
        return null;
      }
    },

    async signIn(email, password) {
      return await sb.auth.signInWithPassword({ email, password });
    },

    async signOut() {
      await sb.auth.signOut();
      window.location.replace('login.html');
    },

    // Sync live MyUplink device readings → Supabase pumps table
    // Matches on pumps.myuplink_device_id = device.id
    async syncMyUplink() {
      if (!window.MyUplink?.isAuthenticated()) return 0;
      try {
        const fleet = await window.MyUplink.getFleet();
        console.info('[YV] MyUplink fleet:', fleet.length, 'device(s) returned');
        let synced = 0;
        for (const dev of fleet) {
          const updates = {};
          if (dev.cop           !== null) updates.cop          = dev.cop;
          if (dev.roomTemp      !== null) updates.temp_indoor  = dev.roomTemp;
          else if (dev.supplyTemp !== null) updates.temp_indoor = dev.supplyTemp;
          if (dev.outdoorTemp   !== null) updates.temp_outdoor = dev.outdoorTemp;
          updates.status    = dev.hasAlarm ? 'fault' : dev.hasWarn ? 'warning' : 'ok';
          updates.alerts    = dev.alarms?.map(a => a.header || a.description || '').filter(Boolean) ?? [];
          updates.last_seen = 'just now';

          const { error } = await sb.from('pumps')
            .update(updates)
            .eq('myuplink_device_id', dev.id);

          if (error) {
            console.warn('[YV] Pump sync error for device', dev.id, ':', error.message);
          } else {
            console.info('[YV] Synced device', dev.id, '→ status:', updates.status, '| COP:', updates.cop ?? '—');
            synced++;
          }
        }
        if (synced === 0 && fleet.length > 0) {
          console.warn('[YV] No pumps matched by myuplink_device_id — check pumps table has device IDs set');
        }
        return synced;
      } catch (e) {
        console.warn('[YV] syncMyUplink error:', e.message);
        return 0;
      }
    },
  };

  // ── Data loader ────────────────────────────────────────────────────────────
  // Attaches to YV immediately if it exists, or waits for YV to be ready
  function attachDataLoader() {
    const target = window.YV || window;
    const fn = async function() {
      const yv = window.YV;
      if (!yv) { console.warn('[YV] loadFromSupabase: window.YV not available'); return; }
      try {
        const { data: pumps, error: pErr } = await sb.from('pumps').select('*');
        if (pErr) { console.error('[YV] Pump load error:', pErr.message); }
        else if (pumps?.length) {
          yv.pumps = pumps.map(p => ({ ...p, alerts: Array.isArray(p.alerts) ? p.alerts : [] }));
          const total = pumps.length;
          const faults = pumps.filter(p => p.status === 'fault').length;
          const warnings = pumps.filter(p => p.status === 'warning').length;
          const online = total - faults;
          const cops = pumps.map(p => p.cop).filter(v => v > 0);
          yv.stats = {
            ...yv.stats, total, faults, warnings, online,
            uptime_pct: +((online / total) * 100).toFixed(1),
            avg_cop: cops.length ? +(cops.reduce((a, b) => a + b, 0) / cops.length).toFixed(1) : 0,
          };
          yv._notify?.();
          console.info('[YV] Loaded', pumps.length, 'pumps from Supabase');
        }
      } catch (e) { console.warn('[YV] Pump load exception:', e.message); }

      try {
        const { data: wo, error: wErr } = await sb.from('work_orders').select('*');
        if (wErr) { console.error('[YV] Work order load error:', wErr.message); }
        else if (wo) {
          window.YV.workOrders = wo;
          console.info('[YV] Loaded', wo.length, 'work orders from Supabase');
        }
      } catch (e) { console.warn('[YV] Work order load exception:', e.message); }
    };

    if (window.YV) {
      window.YV.loadFromSupabase = fn;
    } else {
      // Page may load YV later — expose it globally and let pages call it
      window.YV_loadFromSupabase = fn;
    }
  }

  attachDataLoader();
})();
