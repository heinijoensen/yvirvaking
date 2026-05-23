// Yvirvaking — Shared Data & Utilities
// Falls back to realistic mock data when MyUplink is not connected.

const YV = window.YV = {};

// ── Live data loader ──────────────────────────────────────────────────────────
// Call YV.loadLive() from any page after MyUplink.init().
// Merges live readings into YV.pumps in-place and fires YV.onUpdate listeners.

YV._updateListeners = [];
YV.onUpdate = function(fn) { YV._updateListeners.push(fn); };
YV._notify  = function()   { YV._updateListeners.forEach(fn => fn(YV.pumps)); };

// Geocode an address string → { lat, lng } using Nominatim (OSM, no key needed).
// Results are cached in localStorage so each address is only looked up once.
YV.geocodeAddress = async function(address) {
  if (!address) return null;
  const cacheKey = 'yv_geo_' + address;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address);
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) return null;
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return null;
  }
};

YV.loadLive = async function() {
  if (!window.MyUplink || !MyUplink.isAuthenticated()) return;
  try {
    const fleet = await MyUplink.getFleet();
    if (!fleet.length) return;

    // Merge live readings into existing pump records (matched by serial or index)
    fleet.forEach((live, i) => {
      let pump = YV.pumps.find(p =>
        p.id === live.serial ||
        p.myuplink_device_id === live.id ||
        p._systemId === live.systemId
      ) || YV.pumps[i];
      if (!pump) {
        pump = { id: live.serial, customer: live.name, address: live.address,
                 region: '', lat: null, lng: null, model: live.model,
                 installed: '—', last_seen: 'just now', alerts: [] };
        YV.pumps.push(pump);
      }
      pump._live               = true;
      pump.name                = live.name;
      pump.serial              = live.serial;
      pump.model               = live.model || pump.model;
      pump.address             = live.address || pump.address;
      pump.status              = live.hasAlarm ? 'fault' : live.hasWarn ? 'warning' : 'ok';
      pump.cop                 = live.cop          ?? pump.cop;
      pump.temp_indoor         = live.roomTemp     ?? pump.temp_indoor;
      pump.temp_outdoor        = live.outdoorTemp  ?? pump.temp_outdoor;
      pump.setpoint            = live.setpoint     ?? pump.setpoint;
      pump.alerts              = live.alarms.map(a => `${a.severity}: ${a.header || a.description}`);
      pump.last_seen           = 'live';
      pump.myuplink_device_id  = live.id;
      pump._systemId           = live.systemId;
    });

    // Geocode any live pumps that still lack coordinates (runs in background, re-notifies when done)
    const needsGeo = YV.pumps.filter(p => p._live && (!p.lat || !p.lng) && p.address);
    if (needsGeo.length) {
      Promise.all(needsGeo.map(async pump => {
        const coords = await YV.geocodeAddress(pump.address);
        if (coords) { pump.lat = coords.lat; pump.lng = coords.lng; }
      })).then(() => YV._notify());
    }

    // Recalculate aggregate stats
    const total   = YV.pumps.length;
    const faults  = YV.pumps.filter(p => p.status === 'fault').length;
    const warns   = YV.pumps.filter(p => p.status === 'warning').length;
    const online  = total - faults;
    const cops    = YV.pumps.map(p => p.cop).filter(v => v > 0);
    YV.stats = {
      total, online, faults, warnings: warns,
      uptime_pct: +((online / total) * 100).toFixed(1),
      avg_cop:    cops.length ? +(cops.reduce((a,b) => a+b,0) / cops.length).toFixed(1) : 0,
      energy_today_kwh: YV.stats.energy_today_kwh,
      _live: true,
    };

    YV._notify();
  } catch (err) {
    console.warn('YV.loadLive failed — using mock data:', err.message);
  }
};

YV.pumps = [
  { id: 'P001', customer: 'Jón Petersen',      phone: '+298 211 401', email: 'jon.petersen@gmail.com',      address: 'Áarvegur 12, Tórshavn',        region: 'Streymoy', lat: 62.008, lng: -6.790, status: 'ok',      cop: 3.8, temp_indoor: 21.2, temp_outdoor: 7.1, energy_today: 12.4, model: 'CTC GSi 612',     installed: '2023-03-14', last_seen: '2 min ago',  alerts: [], myuplink_device_id: 'ET731020421655', _systemId: '24baf4ac-634c-4c54-a4fb-acbf27a2888f' },
  { id: 'P002', customer: 'Ragnheiður Holm',   phone: '+298 211 402', email: 'ragnheidur@holm.fo',           address: 'Fjalsgøta 5, Tórshavn',        region: 'Streymoy', lat: 62.015, lng: -6.765, status: 'ok',      cop: 3.5, temp_indoor: 20.8, temp_outdoor: 7.1, energy_today: 9.8,  model: 'CTC EcoAir 520',  installed: '2022-11-02', last_seen: '5 min ago',  alerts: [] },
  { id: 'P003', customer: 'Bjarni Jacobsen',   phone: '+298 211 403', email: 'bjarni.jacobsen@olivant.fo',   address: 'Kirkjubøvegur 3, Velbastaður', region: 'Streymoy', lat: 61.972, lng: -6.842, status: 'warning', cop: 2.1, temp_indoor: 18.4, temp_outdoor: 6.8, energy_today: 18.7, model: 'CTC EcoHeat 400', installed: '2021-06-22', last_seen: '12 min ago', alerts: ['Low COP detected', 'Filter inspection due'] },
  { id: 'P004', customer: 'Marin Olsen',       phone: '+298 211 404', email: 'marin.olsen@gmail.com',        address: 'Breiðablik 8, Hoyvík',         region: 'Streymoy', lat: 62.023, lng: -6.748, status: 'ok',      cop: 4.1, temp_indoor: 22.0, temp_outdoor: 7.2, energy_today: 8.1,  model: 'CTC EcoAir 620',  installed: '2024-01-10', last_seen: '1 min ago',  alerts: [] },
  { id: 'P005', customer: 'Súsanna Dahl',      phone: '+298 211 405', email: 'susanna.dahl@gmail.com',       address: 'Niðasta bygd 2, Kirkjubøur',   region: 'Streymoy', lat: 61.960, lng: -6.878, status: 'fault',   cop: 0.0, temp_indoor: 14.1, temp_outdoor: 6.5, energy_today: 31.2, model: 'CTC EcoHeat 400', installed: '2020-09-05', last_seen: '4 hrs ago',  alerts: ['FAULT: Compressor error E47', 'No hot water since 09:14'] },
  { id: 'P006', customer: 'Heðin Magnusson',   phone: '+298 211 406', email: 'hedin@magnusson.fo',           address: 'Undir Hálsi 7, Klaksvík',      region: 'Norðoyar', lat: 62.229, lng: -6.587, status: 'ok',      cop: 3.9, temp_indoor: 21.5, temp_outdoor: 5.9, energy_today: 11.2, model: 'CTC EcoAir 520',  installed: '2022-04-18', last_seen: '3 min ago',  alerts: [] },
  { id: 'P007', customer: 'Tóra Hansen',       phone: '+298 211 407', email: 'tora.hansen@olivant.fo',       address: 'Klaksvíksvegur 14, Klaksvík',  region: 'Norðoyar', lat: 62.235, lng: -6.578, status: 'warning', cop: 2.4, temp_indoor: 19.1, temp_outdoor: 5.9, energy_today: 22.1, model: 'CTC EcoHeat 600', installed: '2021-12-01', last_seen: '18 min ago', alerts: ['High energy consumption'] },
  { id: 'P008', customer: 'Andrias Patursson', phone: '+298 211 408', email: 'andrias.p@gmail.com',          address: 'Yviri við Strond 1, Eiði',     region: 'Eysturoy', lat: 62.301, lng: -7.093, status: 'ok',      cop: 3.7, temp_indoor: 20.9, temp_outdoor: 6.2, energy_today: 10.5, model: 'CTC EcoAir 620',  installed: '2023-07-30', last_seen: '6 min ago',  alerts: [] },
  { id: 'P009', customer: 'Fríða Niclasen',    phone: '+298 211 409', email: 'frida.niclasen@gmail.com',     address: 'Gøtugøta 4, Runavík',          region: 'Eysturoy', lat: 62.149, lng: -6.717, status: 'fault',   cop: 0.0, temp_indoor: 12.8, temp_outdoor: 6.4, energy_today: 0.0,  model: 'CTC EcoHeat 400', installed: '2019-08-11', last_seen: '6 hrs ago',  alerts: ['FAULT: Communication lost', 'MyUplink offline'] },
  { id: 'P010', customer: 'Dávur Joensen',     phone: '+298 211 410', email: 'davur.joensen@olivant.fo',     address: 'Niðari bygd 9, Sandur',        region: 'Sandoy',   lat: 61.832, lng: -6.818, status: 'ok',      cop: 3.6, temp_indoor: 21.8, temp_outdoor: 7.8, energy_today: 9.3,  model: 'CTC EcoAir 520',  installed: '2023-02-14', last_seen: '4 min ago',  alerts: [] },
  { id: 'P011', customer: 'Rúni Sørensen',     phone: '+298 211 411', email: 'runi.sorensen@gmail.com',      address: 'Uppistova 3, Vágur',           region: 'Suðuroy',  lat: 61.471, lng: -6.808, status: 'ok',      cop: 3.4, temp_indoor: 20.4, temp_outdoor: 8.1, energy_today: 13.1, model: 'CTC EcoHeat 400', installed: '2022-08-25', last_seen: '7 min ago',  alerts: [] },
  { id: 'P012', customer: 'Malan Danielsen',   phone: '+298 211 412', email: 'malan.danielsen@olivant.fo',   address: 'Sandvíksvegur 6, Tvøroyri',    region: 'Suðuroy',  lat: 61.557, lng: -6.801, status: 'warning', cop: 2.7, temp_indoor: 18.8, temp_outdoor: 8.1, energy_today: 19.8, model: 'CTC EcoHeat 600', installed: '2021-03-09', last_seen: '31 min ago', alerts: ['Annual service overdue (14 months)'] },
  { id: 'P013', customer: 'Eyðun Reinert',     phone: '+298 211 413', email: 'eydun.reinert@gmail.com',      address: 'Á Hvammi 11, Sørvágur',        region: 'Vágar',    lat: 62.071, lng: -7.305, status: 'ok',      cop: 4.0, temp_indoor: 21.3, temp_outdoor: 7.4, energy_today: 8.8,  model: 'CTC EcoAir 620',  installed: '2024-04-01', last_seen: '2 min ago',  alerts: [] },
  { id: 'P014', customer: 'Anni Mortensen',    phone: '+298 211 414', email: 'anni.mortensen@olivant.fo',    address: 'Glyvursvegur 2, Glyvrar',      region: 'Eysturoy', lat: 62.172, lng: -6.814, status: 'ok',      cop: 3.8, temp_indoor: 22.1, temp_outdoor: 6.5, energy_today: 10.2, model: 'CTC EcoAir 520',  installed: '2023-05-17', last_seen: '9 min ago',  alerts: [] },
  { id: 'P015', customer: 'Pætur Thomsen',     phone: '+298 211 415', email: 'paetur.thomsen@gmail.com',     address: 'Miðvágsvegur 4, Miðvágur',    region: 'Vágar',    lat: 62.048, lng: -7.209, status: 'warning', cop: 2.2, temp_indoor: 17.9, temp_outdoor: 7.3, energy_today: 24.3, model: 'CTC EcoHeat 400', installed: '2020-11-20', last_seen: '1 hr ago',   alerts: ['Defrost cycle stuck', 'Low COP trend — 3 days'] },
];

YV.workOrders = [
  { id: 'WO-2024-081', pump_id: 'P005', customer: 'Súsanna Dahl',     type: 'Emergency',     status: 'open',        priority: 'high',   desc: 'Compressor fault E47 — no heating/hot water', assigned: 'Pauli Rasmussen', due: '2024-05-04', created: '2024-05-04 09:22' },
  { id: 'WO-2024-080', pump_id: 'P009', customer: 'Fríða Niclasen',   type: 'Emergency',     status: 'open',        priority: 'high',   desc: 'MyUplink communication lost — unit offline',  assigned: 'Súni Jacobsen',   due: '2024-05-04', created: '2024-05-04 07:55' },
  { id: 'WO-2024-079', pump_id: 'P015', customer: 'Pætur Thomsen',    type: 'Maintenance',   status: 'in_progress', priority: 'medium', desc: 'Defrost cycle investigation + COP analysis',  assigned: 'Pauli Rasmussen', due: '2024-05-06', created: '2024-05-03 14:10' },
  { id: 'WO-2024-078', pump_id: 'P003', customer: 'Bjarni Jacobsen',  type: 'Maintenance',   status: 'in_progress', priority: 'medium', desc: 'Filter replacement + performance check',      assigned: 'Súni Jacobsen',   due: '2024-05-07', created: '2024-05-02 11:30' },
  { id: 'WO-2024-077', pump_id: 'P012', customer: 'Malan Danielsen',  type: 'Annual Service',status: 'scheduled',   priority: 'low',    desc: 'Annual service — 14 months overdue',          assigned: 'Pauli Rasmussen', due: '2024-05-10', created: '2024-05-01 09:00' },
  { id: 'WO-2024-075', pump_id: 'P006', customer: 'Heðin Magnusson',  type: 'Annual Service',status: 'completed',   priority: 'low',    desc: 'Annual service completed successfully',       assigned: 'Súni Jacobsen',   due: '2024-04-28', created: '2024-04-20 10:00' },
];

YV.energyTrend = [
  { month: 'Nov', consumption: 1842, avg_cop: 3.2 },
  { month: 'Dec', consumption: 2310, avg_cop: 2.9 },
  { month: 'Jan', consumption: 2480, avg_cop: 2.7 },
  { month: 'Feb', consumption: 2201, avg_cop: 3.0 },
  { month: 'Mar', consumption: 1890, avg_cop: 3.3 },
  { month: 'Apr', consumption: 1320, avg_cop: 3.7 },
  { month: 'May', consumption: 310,  avg_cop: 3.8 },
];

YV.statusColor = { ok: '#22c55e', warning: '#f59e0b', fault: '#ef4444' };
YV.statusLabel = { ok: 'Normal', warning: 'Attention', fault: 'Fault' };

YV.stats = {
  total: 15,
  online: 13,
  faults: 2,
  warnings: 4,
  uptime_pct: 86.7,
  avg_cop: 3.2,
  energy_today_kwh: 209.5,
};

// ── Saved pump persistence ────────────────────────────────────────────────────
// Pumps added via Admin onboarding are stored in localStorage and merged on load.

YV.SAVED_KEY = 'yv_saved_pumps';

YV.loadSaved = function() {
  try {
    const saved = JSON.parse(localStorage.getItem(YV.SAVED_KEY) || '[]');
    saved.forEach(p => {
      if (!YV.pumps.find(e => e.id === p.id)) YV.pumps.push(p);
    });
  } catch {}
};

YV.savePump = function(pump) {
  try {
    const saved = JSON.parse(localStorage.getItem(YV.SAVED_KEY) || '[]');
    const idx = saved.findIndex(p => p.id === pump.id);
    if (idx >= 0) saved[idx] = pump; else saved.push(pump);
    localStorage.setItem(YV.SAVED_KEY, JSON.stringify(saved));
    if (!YV.pumps.find(p => p.id === pump.id)) YV.pumps.push(pump);
    YV.stats.total = YV.pumps.length;
    YV._notify();
  } catch {}
};

YV.deletePump = function(id) {
  try {
    const saved = JSON.parse(localStorage.getItem(YV.SAVED_KEY) || '[]');
    localStorage.setItem(YV.SAVED_KEY, JSON.stringify(saved.filter(p => p.id !== id)));
    const idx = YV.pumps.findIndex(p => p.id === id);
    if (idx >= 0) YV.pumps.splice(idx, 1);
    YV.stats.total = YV.pumps.length;
    YV._notify();
  } catch {}
};

YV.loadSaved();

// Map projection: Faroe Islands approx bounding box
// lat 61.39 - 62.40, lng -7.68 - -6.37
// Map SVG viewBox 0 0 400 500
YV.projectToMap = function(lat, lng) {
  const minLat = 61.35, maxLat = 62.45;
  const minLng = -7.75, maxLng = -6.25;
  const x = ((lng - minLng) / (maxLng - minLng)) * 400;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 500;
  return { x, y };
};
