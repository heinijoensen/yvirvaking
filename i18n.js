/**
 * i18n.js — Yvirvaking internationalisation
 * Supported languages: en (English), da (Danish), sv (Swedish)
 *
 * Usage:
 *   T('key')              — returns string in current language
 *   T('key', {n: 5})      — interpolates {n} placeholder
 *   I18n.getLang()        — 'en' | 'da' | 'sv'
 *   I18n.setLang('da')    — change language, fires 'yv:langchange' event
 *   I18n.onLangChange(fn) — subscribe to language changes
 *   I18n.renderToggle(el) — inject a <select> language switcher into el
 */

const I18n = window.I18n = (() => {
  const STORAGE_KEY = 'yvirvaking_lang';
  const listeners = [];

  const translations = {
    en: {
      // App
      'app.name': 'Yvirvaking',
      'app.tagline': 'Heat Pump Monitoring',
      'app.sub': 'Maria Poulsen CTC',

      // Theme
      'theme.dark': 'Dark',
      'theme.light': 'Light',
      'theme.system': 'System',

      // Language names
      'lang.en': 'English',
      'lang.da': 'Dansk',
      'lang.sv': 'Svenska',

      // Navigation (internal tools)
      'nav.dashboard': 'Dashboard',
      'nav.fleet': 'Fleet',
      'nav.workorders': 'Work Orders',
      'nav.reports': 'Reports',
      'nav.customers': 'Customers',
      'nav.search': 'Search pumps, customers…',
      'nav.back': '← Back',
      'nav.serviceview': 'Service View →',

      // Connection bar (index.html)
      'conn.connected': 'Connected',
      'conn.connecting': 'Connecting…',
      'conn.disconnected': 'Disconnected',
      'conn.connect': 'Connect MyUplink',
      'conn.reconnect': 'Reconnect',
      'conn.disconnect': 'Disconnect',
      'conn.system': 'system',
      'conn.systems': 'systems',
      'conn.device': 'device',
      'conn.devices': 'devices',
      'conn.error': 'Connection error',

      // Status labels
      'status.ok': 'Normal',
      'status.warning': 'Attention',
      'status.fault': 'Fault',
      'status.connected': 'Connected',
      'status.offline': 'Offline',
      'status.live': 'live',

      // Tier1 — stats bar
      'stat.total': 'Total Pumps',
      'stat.faults': 'Faults',
      'stat.warnings': 'Warnings',
      'stat.avgcop': 'Avg COP',
      'stat.uptime': 'Fleet Uptime',
      'stat.energytoday': 'Energy Today',

      // Tier1 — map
      'map.allpumps': 'All pumps',
      'map.pumpsshown': '{n} pumps shown',

      // Tier1 — alerts panel
      'alerts.title': 'Active Alerts',
      'alerts.live': '● live',
      'alerts.mock': 'mock',
      'alerts.delay': '{n}min delay',
      'alerts.delayexplain': 'Faults visible to company {n} min before the customer app is notified. Adjust window:',
      'alerts.window.title': 'Intervention window open',
      'alerts.window.sub': '{n} alert not yet visible to customer',
      'alerts.window.sub_plural': '{n} alerts not yet visible to customer',
      'alerts.notified': 'Customer notified',
      'alerts.notifiedin': 'Customer notified in ~{n}m',
      'alerts.suppress': 'Suppress →',

      // Tier1 — chart & recent
      'chart.title': 'Fleet Energy (kWh/mo) + Avg COP',
      'recent.title': 'Recently Installed',

      // Tier2 — tabs
      'tab.overview': 'Overview',
      'tab.diagnostics': 'Diagnostics',
      'tab.history': 'History',
      'tab.report': 'Service Report',
      'tab.documents': 'Documents',
      'tab.settings': 'Settings',
      'tab.customer': 'Customer',
      'tab.notes': 'Notes',

      // Tier2 — service report actions
      'report.sendemail': '✉ Send Status Email',
      'report.print': '🖨 Print / PDF',
      'report.exportbc': '⬇ Export BC JSON',
      'report.hours': 'Hours',
      'report.materials': 'Materials',
      'report.status': 'Status',

      // Tier25 — field app
      'field.jobs': 'Jobs',
      'field.scan': 'Scan',
      'field.checklist': 'Checklist',
      'field.sync': 'Sync',
      'field.syncing': 'Syncing…',
      'field.synced': 'All synced',

      // Tier3 — home screen
      'home.status.ok': 'Everything is fine',
      'home.status.fault': 'Action needed',
      'home.status.warning': 'Check recommended',
      'home.indoor': 'Indoor',
      'home.outdoor': 'Outside',
      'home.hotwater': 'Hot water',
      'home.target': 'Target temperature',
      'home.mode.comfort': '🏠 Normal',
      'home.mode.eco': '🌿 Energy saver',
      'home.mode.holiday': '✈️ Away',
      'home.boost.title': 'Hot water now',
      'home.boost.sub': 'Tap to heat tank to 60°C — ready in ~45 min',
      'home.boost.btn': 'Start',
      'home.boost.active': 'Heating water…',
      'home.boost.activesub': 'Tank heating to 60°C. Ready in ~45 min.',

      // Tier3 — bottom nav
      'nav.home': 'Home',
      'nav.energy': 'Energy',
      'nav.support': 'Support',
      'nav.more': 'More',

      // Tier3 — energy screen
      'energy.week': 'Week',
      'energy.month': 'Month',
      'energy.year': 'Year',
      'energy.thisweek': 'This week',
      'energy.thismonth': 'April 2024',
      'energy.lastyear': 'Last 12 months',
      'energy.change': '−12% vs prior {period}',
      'energy.cop.title': 'Good Efficiency',
      'energy.cop.desc': 'Your pump produces {cop}x more heat than electricity used — above the Faroe Islands average of 3.1.',
      'energy.details': 'Details & Reports',
      'energy.details.show': '▼ Show',
      'energy.details.hide': '▲ Hide',
      'energy.compare': 'How do you compare?',
      'energy.compare.sub': 'Anonymous comparison with similar homes',
      'energy.compare.footnote': 'Based on 15 CTC pumps in the Faroe Islands. Data anonymised.',
      'energy.report.title': 'Download Report',
      'energy.report.from': 'FROM',
      'energy.report.to': 'TO',
      'energy.report.preview': 'Preview Report',
      'energy.report.pdf': 'PDF ↓',
      'energy.ai.title': 'AI Analysis',
      'energy.ai.btn': 'Analyse this period ✦',
      'energy.ai.loading': 'Analysing your data…',
      'energy.ai.again': 'Analyse again ↺',
      'energy.tip.head': '💡 Energy Tip',
      'energy.tip.body': 'Lowering your setpoint by 1°C at night can reduce energy use by up to 8%. Try the Schedule feature to set it automatically.',

      // Tier3 — support screen
      'support.online': 'Online — responds in minutes',
      'support.call': 'Call us',
      'support.placeholder': 'Message support…',

      // Tier3 — more screen
      'more.schedule': 'Schedule',
      'more.schedule.sub': 'Set temperature by time of day',
      'more.bookservice': 'Book Service',
      'more.bookservice.sub': 'Request a technician visit',
      'more.history': 'Service History',
      'more.history.sub': 'Past visits and reports',
      'more.documents': 'Documents',
      'more.documents.sub': 'Warranty, manuals, invoices',
      'more.notifications': 'Notifications',
      'more.notifications.sub': 'Alerts and reminders',
      'more.winter': 'Winter Mode',
      'more.winter.sub': 'Cold weather settings',
      'more.annualreport': 'Annual Report',
      'more.annualreport.sub': 'Download energy report',
      'more.settings': 'Settings',
      'more.settings.sub': 'App preferences',
      'more.switchdashboard': '← Switch to Company Dashboard',
    },

    da: {
      'app.name': 'Yvirvaking',
      'app.tagline': 'Varmepumpeovervågning',
      'app.sub': 'Maria Poulsen CTC',

      'theme.dark': 'Mørk',
      'theme.light': 'Lys',
      'theme.system': 'System',

      'lang.en': 'English',
      'lang.da': 'Dansk',
      'lang.sv': 'Svenska',

      'nav.dashboard': 'Oversigt',
      'nav.fleet': 'Flåde',
      'nav.workorders': 'Arbejdsordrer',
      'nav.reports': 'Rapporter',
      'nav.customers': 'Kunder',
      'nav.search': 'Søg pumper, kunder…',
      'nav.back': '← Tilbage',
      'nav.serviceview': 'Servicevisning →',

      'conn.connected': 'Forbundet',
      'conn.connecting': 'Forbinder…',
      'conn.disconnected': 'Afbrudt',
      'conn.connect': 'Forbind MyUplink',
      'conn.reconnect': 'Genopret forbindelse',
      'conn.disconnect': 'Afbryd',
      'conn.system': 'system',
      'conn.systems': 'systemer',
      'conn.device': 'enhed',
      'conn.devices': 'enheder',
      'conn.error': 'Forbindelsesfejl',

      'status.ok': 'Normal',
      'status.warning': 'Advarsel',
      'status.fault': 'Fejl',
      'status.connected': 'Forbundet',
      'status.offline': 'Offline',
      'status.live': 'live',

      'stat.total': 'Pumper i alt',
      'stat.faults': 'Fejl',
      'stat.warnings': 'Advarsler',
      'stat.avgcop': 'Gns. COP',
      'stat.uptime': 'Flåde oppetid',
      'stat.energytoday': 'Energi i dag',

      'map.allpumps': 'Alle pumper',
      'map.pumpsshown': '{n} pumper vist',

      'alerts.title': 'Aktive alarmer',
      'alerts.live': '● live',
      'alerts.mock': 'mock',
      'alerts.delay': '{n}min forsinkelse',
      'alerts.delayexplain': 'Fejl synlige for virksomheden {n} min. før kunden underrettes. Juster vindue:',
      'alerts.window.title': 'Interventionsvindue åbent',
      'alerts.window.sub': '{n} alarm endnu ikke synlig for kunden',
      'alerts.window.sub_plural': '{n} alarmer endnu ikke synlige for kunden',
      'alerts.notified': 'Kunden underrettet',
      'alerts.notifiedin': 'Kunden underrettes om ~{n}m',
      'alerts.suppress': 'Undertryk →',

      'chart.title': 'Flådeenergi (kWh/md) + Gns. COP',
      'recent.title': 'Nyligt installeret',

      'tab.overview': 'Oversigt',
      'tab.diagnostics': 'Diagnostik',
      'tab.history': 'Historik',
      'tab.report': 'Servicerapport',
      'tab.documents': 'Dokumenter',
      'tab.settings': 'Indstillinger',
      'tab.customer': 'Kunde',
      'tab.notes': 'Noter',

      'report.sendemail': '✉ Send statusmail',
      'report.print': '🖨 Udskriv / PDF',
      'report.exportbc': '⬇ Eksporter BC JSON',
      'report.hours': 'Timer',
      'report.materials': 'Materialer',
      'report.status': 'Status',

      'field.jobs': 'Opgaver',
      'field.scan': 'Scan',
      'field.checklist': 'Tjekliste',
      'field.sync': 'Synkroniser',
      'field.syncing': 'Synkroniserer…',
      'field.synced': 'Alt synkroniseret',

      'home.status.ok': 'Alt er i orden',
      'home.status.fault': 'Handling krævet',
      'home.status.warning': 'Kontrol anbefalet',
      'home.indoor': 'Indendørs',
      'home.outdoor': 'Udendørs',
      'home.hotwater': 'Varmt vand',
      'home.target': 'Måltemperatur',
      'home.mode.comfort': '🏠 Normal',
      'home.mode.eco': '🌿 Energibesparende',
      'home.mode.holiday': '✈️ Væk',
      'home.boost.title': 'Varmt vand nu',
      'home.boost.sub': 'Tryk for at varme beholder til 60°C — klar om ca. 45 min',
      'home.boost.btn': 'Start',
      'home.boost.active': 'Varmer vand…',
      'home.boost.activesub': 'Beholder varmes til 60°C. Klar om ca. 45 min.',

      'nav.home': 'Hjem',
      'nav.energy': 'Energi',
      'nav.support': 'Support',
      'nav.more': 'Mere',

      'energy.week': 'Uge',
      'energy.month': 'Måned',
      'energy.year': 'År',
      'energy.thisweek': 'Denne uge',
      'energy.thismonth': 'April 2024',
      'energy.lastyear': 'Seneste 12 måneder',
      'energy.change': '−12% ift. forrige {period}',
      'energy.cop.title': 'God effektivitet',
      'energy.cop.desc': 'Din pumpe producerer {cop}x mere varme end den brugte el — over Færøernes gennemsnit på 3,1.',
      'energy.details': 'Detaljer og rapporter',
      'energy.details.show': '▼ Vis',
      'energy.details.hide': '▲ Skjul',
      'energy.compare': 'Hvordan klarer du dig?',
      'energy.compare.sub': 'Anonym sammenligning med lignende hjem',
      'energy.compare.footnote': 'Baseret på 15 CTC-pumper på Færøerne. Data anonymiseret.',
      'energy.report.title': 'Download rapport',
      'energy.report.from': 'FRA',
      'energy.report.to': 'TIL',
      'energy.report.preview': 'Forhåndsvis rapport',
      'energy.report.pdf': 'PDF ↓',
      'energy.ai.title': 'AI-analyse',
      'energy.ai.btn': 'Analysér denne periode ✦',
      'energy.ai.loading': 'Analyserer dine data…',
      'energy.ai.again': 'Analysér igen ↺',
      'energy.tip.head': '💡 Energitip',
      'energy.tip.body': 'At sænke din indstilling med 1°C om natten kan reducere energiforbruget med op til 8%. Prøv planlægningsfunktionen for at indstille det automatisk.',

      'support.online': 'Online — svarer inden for minutter',
      'support.call': 'Ring til os',
      'support.placeholder': 'Skriv til support…',

      'more.schedule': 'Planlægning',
      'more.schedule.sub': 'Indstil temperatur efter tidspunkt',
      'more.bookservice': 'Bestil service',
      'more.bookservice.sub': 'Anmod om teknikerbesøg',
      'more.history': 'Servicehistorik',
      'more.history.sub': 'Tidligere besøg og rapporter',
      'more.documents': 'Dokumenter',
      'more.documents.sub': 'Garanti, manualer, fakturaer',
      'more.notifications': 'Notifikationer',
      'more.notifications.sub': 'Alarmer og påmindelser',
      'more.winter': 'Vintertilstand',
      'more.winter.sub': 'Koltvejrsindstillinger',
      'more.annualreport': 'Årsrapport',
      'more.annualreport.sub': 'Download energirapport',
      'more.settings': 'Indstillinger',
      'more.settings.sub': 'App-præferencer',
      'more.switchdashboard': '← Skift til firmaoversigt',
    },

    sv: {
      'app.name': 'Yvirvaking',
      'app.tagline': 'Värmepumpsövervakning',
      'app.sub': 'Maria Poulsen CTC',

      'theme.dark': 'Mörkt',
      'theme.light': 'Ljust',
      'theme.system': 'System',

      'lang.en': 'English',
      'lang.da': 'Dansk',
      'lang.sv': 'Svenska',

      'nav.dashboard': 'Översikt',
      'nav.fleet': 'Flotta',
      'nav.workorders': 'Arbetsordrar',
      'nav.reports': 'Rapporter',
      'nav.customers': 'Kunder',
      'nav.search': 'Sök pumpar, kunder…',
      'nav.back': '← Tillbaka',
      'nav.serviceview': 'Servicevy →',

      'conn.connected': 'Ansluten',
      'conn.connecting': 'Ansluter…',
      'conn.disconnected': 'Frånkopplad',
      'conn.connect': 'Anslut MyUplink',
      'conn.reconnect': 'Återanslut',
      'conn.disconnect': 'Koppla från',
      'conn.system': 'system',
      'conn.systems': 'system',
      'conn.device': 'enhet',
      'conn.devices': 'enheter',
      'conn.error': 'Anslutningsfel',

      'status.ok': 'Normal',
      'status.warning': 'Varning',
      'status.fault': 'Fel',
      'status.connected': 'Ansluten',
      'status.offline': 'Offline',
      'status.live': 'live',

      'stat.total': 'Totalt pumpar',
      'stat.faults': 'Fel',
      'stat.warnings': 'Varningar',
      'stat.avgcop': 'Avg COP',
      'stat.uptime': 'Flottans drifttid',
      'stat.energytoday': 'Energi idag',

      'map.allpumps': 'Alla pumpar',
      'map.pumpsshown': '{n} pumpar visas',

      'alerts.title': 'Aktiva larm',
      'alerts.live': '● live',
      'alerts.mock': 'mock',
      'alerts.delay': '{n}min fördröjning',
      'alerts.delayexplain': 'Fel synliga för företaget {n} min innan kunden notifieras. Justera fönster:',
      'alerts.window.title': 'Ingrepp möjligt',
      'alerts.window.sub': '{n} larm ännu inte synligt för kund',
      'alerts.window.sub_plural': '{n} larm ännu inte synliga för kund',
      'alerts.notified': 'Kund notifierad',
      'alerts.notifiedin': 'Kund notifieras om ~{n}m',
      'alerts.suppress': 'Tysta →',

      'chart.title': 'Flottenenergi (kWh/mån) + Avg COP',
      'recent.title': 'Nyligen installerade',

      'tab.overview': 'Översikt',
      'tab.diagnostics': 'Diagnostik',
      'tab.history': 'Historik',
      'tab.report': 'Servicerapport',
      'tab.documents': 'Dokument',
      'tab.settings': 'Inställningar',
      'tab.customer': 'Kund',
      'tab.notes': 'Anteckningar',

      'report.sendemail': '✉ Skicka statusmail',
      'report.print': '🖨 Skriv ut / PDF',
      'report.exportbc': '⬇ Exportera BC JSON',
      'report.hours': 'Timmar',
      'report.materials': 'Material',
      'report.status': 'Status',

      'field.jobs': 'Jobb',
      'field.scan': 'Skanna',
      'field.checklist': 'Checklista',
      'field.sync': 'Synkronisera',
      'field.syncing': 'Synkroniserar…',
      'field.synced': 'Allt synkroniserat',

      'home.status.ok': 'Allt är bra',
      'home.status.fault': 'Åtgärd krävs',
      'home.status.warning': 'Kontroll rekommenderas',
      'home.indoor': 'Inomhus',
      'home.outdoor': 'Utomhus',
      'home.hotwater': 'Varmvatten',
      'home.target': 'Måltemperatur',
      'home.mode.comfort': '🏠 Normal',
      'home.mode.eco': '🌿 Energisparande',
      'home.mode.holiday': '✈️ Borta',
      'home.boost.title': 'Varmvatten nu',
      'home.boost.sub': 'Tryck för att värma tank till 60°C — klar om ~45 min',
      'home.boost.btn': 'Starta',
      'home.boost.active': 'Värmer vatten…',
      'home.boost.activesub': 'Tank värms till 60°C. Klar om ~45 min.',

      'nav.home': 'Hem',
      'nav.energy': 'Energi',
      'nav.support': 'Support',
      'nav.more': 'Mer',

      'energy.week': 'Vecka',
      'energy.month': 'Månad',
      'energy.year': 'År',
      'energy.thisweek': 'Den här veckan',
      'energy.thismonth': 'April 2024',
      'energy.lastyear': 'Senaste 12 månaderna',
      'energy.change': '−12% vs föregående {period}',
      'energy.cop.title': 'Bra effektivitet',
      'energy.cop.desc': 'Din pump producerar {cop}x mer värme än el som används — över Färöarnas genomsnitt på 3,1.',
      'energy.details': 'Detaljer och rapporter',
      'energy.details.show': '▼ Visa',
      'energy.details.hide': '▲ Dölj',
      'energy.compare': 'Hur gör du jämfört?',
      'energy.compare.sub': 'Anonym jämförelse med liknande hem',
      'energy.compare.footnote': 'Baserat på 15 CTC-pumpar på Färöarna. Data anonymiserade.',
      'energy.report.title': 'Ladda ner rapport',
      'energy.report.from': 'FRÅN',
      'energy.report.to': 'TILL',
      'energy.report.preview': 'Förhandsgranska rapport',
      'energy.report.pdf': 'PDF ↓',
      'energy.ai.title': 'AI-analys',
      'energy.ai.btn': 'Analysera denna period ✦',
      'energy.ai.loading': 'Analyserar dina data…',
      'energy.ai.again': 'Analysera igen ↺',
      'energy.tip.head': '💡 Energitips',
      'energy.tip.body': 'Att sänka din inställning med 1°C på natten kan minska energianvändningen med upp till 8%. Prova Schema-funktionen för att ställa in det automatiskt.',

      'support.online': 'Online — svarar inom minuter',
      'support.call': 'Ring oss',
      'support.placeholder': 'Meddelande till support…',

      'more.schedule': 'Schema',
      'more.schedule.sub': 'Ställ in temperatur efter tid',
      'more.bookservice': 'Boka service',
      'more.bookservice.sub': 'Begär ett teknikerbesök',
      'more.history': 'Servicehistorik',
      'more.history.sub': 'Tidigare besök och rapporter',
      'more.documents': 'Dokument',
      'more.documents.sub': 'Garanti, manualer, fakturor',
      'more.notifications': 'Aviseringar',
      'more.notifications.sub': 'Larm och påminnelser',
      'more.winter': 'Vinterläge',
      'more.winter.sub': 'Kallt väderinställningar',
      'more.annualreport': 'Årsrapport',
      'more.annualreport.sub': 'Ladda ner energirapport',
      'more.settings': 'Inställningar',
      'more.settings.sub': 'Appinställningar',
      'more.switchdashboard': '← Byt till företagsdashboard',
    },
  };

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function setLang(lang) {
    if (!translations[lang]) return;
    localStorage.setItem(STORAGE_KEY, lang);
    listeners.forEach(fn => fn(lang));
    document.dispatchEvent(new CustomEvent('yv:langchange', { detail: lang }));
    // Update <html lang> attribute
    document.documentElement.setAttribute('lang', lang);
  }

  function onLangChange(fn) {
    listeners.push(fn);
  }

  // Apply lang attribute on load
  document.documentElement.setAttribute('lang', getLang());

  return { getLang, setLang, onLangChange, translations };
})();

/**
 * T(key, vars?) — global translation function
 * T('alerts.notifiedin', { n: 12 }) → "Customer notified in ~12m"
 */
window.T = function(key, vars) {
  const lang = I18n.getLang();
  let str = I18n.translations[lang]?.[key] ?? I18n.translations.en?.[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
  }
  return str;
};
