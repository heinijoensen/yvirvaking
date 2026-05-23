/**
 * notifications.js — Yvirvaking cross-tab notification store
 *
 * Notification types:
 *   fault        — pump has a fault → assigned installer
 *   warning      — pump warning → assigned installer (lower priority)
 *   help_request — customer pressed SOS → on-call installer (urgent)
 *   message      — installer → customer (or customer → installer)
 *   resolved     — issue cleared by installer → customer
 *
 * All notifications live in localStorage and are broadcast via BroadcastChannel
 * so any open tab (Field App, Dashboard, Customer App) sees them instantly.
 */
window.YV_NOTIFY = (() => {
  const STORE_KEY = 'yv_notifications';
  const CHANNEL   = 'yv_notifications';
  const listeners = [];
  let _bc = null;

  function _getBC() {
    if (!window.BroadcastChannel) return null;
    if (!_bc) {
      _bc = new BroadcastChannel(CHANNEL);
      _bc.onmessage = (e) => {
        if (e.data?.type === 'notification') listeners.forEach(fn => fn(e.data.notification));
      };
    }
    return _bc;
  }

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function _save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-200))); } catch {}
  }

  function _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const api = {
    // Push a new notification. Returns the notification object.
    push({ type, pumpId, installerIds, title, body, meta = {} }) {
      const n = {
        id: _id(),
        type,
        pumpId,
        installerIds: installerIds || [],
        title,
        body,
        meta,
        timestamp: Date.now(),
        acked: false,
        resolved: false,
        resolvedNote: null,
        resolvedAt: null,
        thread: [],   // { from, text, ts }[]
      };
      const list = _load();
      // deduplicate: don't push another fault for same pump within 5 min
      if (type === 'fault' || type === 'warning') {
        const recent = list.find(x =>
          x.pumpId === pumpId && x.type === type && !x.resolved &&
          Date.now() - x.timestamp < 5 * 60 * 1000
        );
        if (recent) return recent;
      }
      list.push(n);
      _save(list);
      _getBC()?.postMessage({ type: 'notification', notification: n });
      listeners.forEach(fn => fn(n));
      return n;
    },

    getAll() { return _load(); },

    // Notifications for a specific installer (or all if installerId omitted)
    getForInstaller(installerId) {
      return _load().filter(n => !installerId || n.installerIds.includes(installerId));
    },

    // Unread count for an installer
    unreadCount(installerId) {
      return _load().filter(n =>
        (!installerId || n.installerIds.includes(installerId)) && !n.acked && !n.resolved
      ).length;
    },

    acknowledge(id) {
      const list = _load();
      const n = list.find(x => x.id === id);
      if (n) { n.acked = true; _save(list); }
    },

    // Installer clears / resolves issue
    resolve(id, note = '') {
      const list = _load();
      const n = list.find(x => x.id === id);
      if (!n) return;
      n.resolved = true;
      n.resolvedNote = note;
      n.resolvedAt = Date.now();
      _save(list);
      _getBC()?.postMessage({ type: 'notification', notification: n });
      listeners.forEach(fn => fn(n));
      // Auto-push a "resolved" notification for the customer
      if (n.pumpId) {
        this.push({
          type: 'resolved',
          pumpId: n.pumpId,
          installerIds: n.installerIds,
          title: 'Issue cleared',
          body: note || 'Your installer has resolved the issue.',
          meta: { parentId: id },
        });
      }
      return n;
    },

    // Append a chat message to a notification thread
    addMessage(id, from, text) {
      const list = _load();
      const n = list.find(x => x.id === id);
      if (!n) return;
      n.thread.push({ from, text, ts: Date.now() });
      _save(list);
      _getBC()?.postMessage({ type: 'notification', notification: n });
      listeners.forEach(fn => fn(n));
      return n;
    },

    // Send a new direct message between installer and customer
    sendMessage({ pumpId, fromName, fromRole, toName, text, installerIds }) {
      return this.push({
        type: 'message',
        pumpId,
        installerIds,
        title: `Message from ${fromName}`,
        body: text,
        meta: { fromName, fromRole, toName },
      });
    },

    // Customer presses SOS / "Call for Help"
    helpRequest({ pumpId, customerName, note }) {
      const installer = window.YV_USERS?.getOnCallInstaller();
      return this.push({
        type: 'help_request',
        pumpId,
        installerIds: installer ? [installer.id] : [],
        title: `Help request — ${customerName}`,
        body: note || 'Customer requesting immediate assistance.',
        meta: { customerName, urgent: true },
      });
    },

    // Auto-generate fault/warning notifications from pump list
    syncFromPumps(pumps) {
      if (!window.YV_USERS) return;
      pumps.forEach(p => {
        if (p.status === 'fault' || p.status === 'warning') {
          const installer = YV_USERS.getInstallerForPump(p.id);
          this.push({
            type: p.status,
            pumpId: p.id,
            installerIds: installer ? [installer.id] : [],
            title: p.status === 'fault' ? `Fault — ${p.customer}` : `Warning — ${p.customer}`,
            body: p.alerts[0] || (p.status === 'fault' ? 'Pump fault detected' : 'Attention required'),
            meta: { address: p.address, model: p.model },
          });
        }
      });
    },

    // Subscribe to new/updated notifications
    onNew(fn) {
      listeners.push(fn);
      _getBC(); // ensure channel is open
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    // Clear all (dev/debug only)
    clearAll() { localStorage.removeItem(STORE_KEY); },
  };

  return api;
})();
