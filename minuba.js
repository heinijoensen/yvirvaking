/**
 * minuba.js — Minuba field service management API wrapper for Yvirvaking
 *
 * Minuba is the FSM system used by Maria Poulsen Rør for service orders,
 * job scheduling, and technician dispatch.
 *
 * Usage:
 *   MinubaAPI.isConfigured()              — true if API key is set
 *   MinubaAPI.setApiKey(key)              — save key (persists to localStorage)
 *   MinubaAPI.getOrders(params)           — fetch active orders for today's jobs
 *   MinubaAPI.createOrder(data)           — create a new service order
 *   MinubaAPI.pushServiceReport(payload)  — create order + expense/time lines from a completed service report
 *
 * API key: set in YVIRVAKING_CONFIG.minuba.apiKey (config.js)
 * OR call MinubaAPI.setApiKey('your-key') at runtime.
 * Get your key in Minuba: Settings → Administration → Integration Module.
 *
 * Docs: https://app.minuba.dk/static/apidoc/api.xml
 */

window.MinubaAPI = (() => {
  const STORAGE_KEY = 'yv_minuba_api_key';
  const BASE        = 'https://app.minuba.dk/api/v1';

  // ─── Auth ────────────────────────────────────────────────────────────────────

  function apiKey() {
    return window.YVIRVAKING_CONFIG?.minuba?.apiKey
      || localStorage.getItem(STORAGE_KEY)
      || '';
  }

  // ─── Core request ────────────────────────────────────────────────────────────

  async function req(method, path, body) {
    const key = apiKey();
    if (!key) throw new Error('Minuba API key not configured. Set YVIRVAKING_CONFIG.minuba.apiKey or call MinubaAPI.setApiKey().');

    const opts = {
      method,
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(`${BASE}${path}`, opts);
    } catch (e) {
      throw new Error(`Minuba network error: ${e.message}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`Minuba ${res.status} ${res.statusText}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  // ─── Orders ──────────────────────────────────────────────────────────────────

  /**
   * Get orders from Minuba.
   * @param {Object} params - optional filters e.g. { status: 'ACTIVE', assignedTo: 'Pauli' }
   */
  async function getOrders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/orders${qs ? '?' + qs : ''}`);
  }

  async function getOrder(id) {
    return req('GET', `/orders/${id}`);
  }

  async function createOrder(data) {
    return req('POST', '/orders', data);
  }

  async function updateOrder(id, data) {
    return req('PATCH', `/orders/${id}`, data);
  }

  // ─── Expense lines (time + materials on an order) ─────────────────────────

  async function getExpenseLines(orderId) {
    return req('GET', `/orders/${orderId}/expenselines`);
  }

  /**
   * Add an expense line to an order.
   * @param {string} orderId
   * @param {Object} line - { type: 'TIME'|'MATERIAL', hours?, description, quantity?, unitPrice? }
   */
  async function createExpenseLine(orderId, line) {
    return req('POST', `/orders/${orderId}/expenselines`, line);
  }

  // ─── Notes ───────────────────────────────────────────────────────────────────

  async function createNote(orderId, text) {
    return req('POST', `/orders/${orderId}/notes`, { content: text });
  }

  // ─── Clients ─────────────────────────────────────────────────────────────────

  async function getClients(search) {
    return req('GET', `/clients${search ? '?search=' + encodeURIComponent(search) : ''}`);
  }

  // ─── Map Minuba order → YV job format ────────────────────────────────────────

  function orderToJob(order) {
    const pump = window.YV?.pumps?.find(p =>
      p.id === order.reference || p.customer?.toLowerCase() === order.clientName?.toLowerCase()
    ) || null;

    // Map Minuba status → YV status
    const statusMap = {
      PROPOSAL:   'open',
      ACTIVE:     'today',
      PAUSED:     'open',
      DONE:       'completed',
      CANCELLED:  'completed',
      INVOICED:   'completed',
    };

    return {
      id:         `MIN-${order.id}`,
      _minubaId:  order.id,
      _source:    'minuba',
      type:       order.orderType || 'Service',
      status:     statusMap[order.status] || 'open',
      priority:   order.priority === 'HIGH' ? 'high' : order.priority === 'LOW' ? 'low' : 'medium',
      time:       order.dueDate ? order.dueDate.slice(0, 10) : 'TBD',
      due:        order.dueDate || null,
      assigned:   order.assignedWorker?.name || '',
      pump,
      note:       order.description || '',
      // Keep original Minuba fields for reference
      _order:     order,
    };
  }

  // ─── Push a completed service report to Minuba ───────────────────────────────

  /**
   * Create a full service order in Minuba from a completed wizard report.
   *
   * @param {Object} payload
   *   pump        — YV pump object
   *   installer   — { id, name } — the technician
   *   checked     — Set of completed checklist items
   *   checklist   — full CHECKLIST array
   *   measurements — { flow, return, tank, cop, kwh }
   *   timeHours   — number of hours worked
   *   materials   — [{ name, qty, price }] optional
   *   description — free-text notes
   *   date        — ISO date string
   *
   * @returns {Object} created Minuba order
   */
  async function pushServiceReport({ pump, installer, checked, checklist, measurements, timeHours, materials, description, date }) {
    const today = date || new Date().toISOString().split('T')[0];

    // 1 — Create the order
    const checklistSummary = checklist
      ? checklist.map(c => `[${checked?.has(c.id) ? '✓' : ' '}] ${c.label}`).join('\n')
      : '';

    const measurementSummary = [
      measurements?.flow  && `Flow temp: ${measurements.flow}°C`,
      measurements?.return && `Return temp: ${measurements.return}°C`,
      measurements?.tank  && `Tank temp: ${measurements.tank}°C`,
      measurements?.cop   && `COP: ${measurements.cop}`,
      measurements?.kwh   && `Energy: ${measurements.kwh} kWh`,
    ].filter(Boolean).join(' · ');

    const fullDescription = [
      `Annual service — ${pump.model}`,
      measurementSummary,
      description,
    ].filter(Boolean).join('\n');

    const order = await createOrder({
      title:       `Service — ${pump.customer}`,
      description: fullDescription,
      reference:   pump.id,
      status:      'DONE',
      dueDate:     today,
      // clientId would be set if we have the Minuba client ID stored on the pump
      ...(pump._minubaClientId && { clientId: pump._minubaClientId }),
    });

    if (!order?.id) throw new Error('Minuba order creation failed — no ID returned');

    // 2 — Add checklist note
    if (checklist && checked?.size > 0) {
      await createNote(order.id,
        `Checklist (${checked.size}/${checklist.length} completed):\n${checklistSummary}`
      );
    }

    // 3 — Time expense line
    if (timeHours && timeHours > 0) {
      await createExpenseLine(order.id, {
        type:        'TIME',
        hours:       timeHours,
        description: `Service visit — ${installer?.name || 'Technician'}`,
        workerId:    installer?.id,
      });
    }

    // 4 — Material expense lines
    for (const mat of (materials || [])) {
      if (!mat.name) continue;
      await createExpenseLine(order.id, {
        type:        'MATERIAL',
        description: mat.name,
        quantity:    mat.qty || 1,
        unitPrice:   mat.price || 0,
      });
    }

    return order;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  return {
    isConfigured:      () => !!apiKey(),
    setApiKey:         (key) => { try { localStorage.setItem(STORAGE_KEY, key); } catch {} },
    getApiKey:         () => apiKey(),

    // Orders
    getOrders,
    getOrder,
    createOrder,
    updateOrder,

    // Expense lines
    getExpenseLines,
    createExpenseLine,

    // Notes
    createNote,

    // Clients
    getClients,

    // High-level helpers
    orderToJob,
    pushServiceReport,
  };
})();
