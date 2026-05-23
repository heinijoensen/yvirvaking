/**
 * theme.js — Yvirvaking shared theme system
 * Supports: dark | light | system
 * Usage: load this script in <head>, then call Theme.init()
 * The toggle button is injected by Theme.renderToggle(containerId)
 */
const Theme = (() => {
  const KEY = 'yv_theme';

  const LIGHT = {
    '--bg':     '#f4f6f9',
    '--bg2':    '#edf0f4',
    '--bg3':    '#ffffff',
    '--bg4':    '#e4e9f0',
    '--border': '#cdd5e0',
    '--text':   '#0d1520',
    '--text2':  '#3a526b',
    '--text3':  '#7f9ab5',
    '--red':    '#c0392b',
    '--blue':   '#2176ae',
    '--yellow': '#d4800a',
    '--green':  '#1a8a52',
  };

  const DARK = {
    '--bg':     '#09111d',
    '--bg2':    '#0d1520',
    '--bg3':    '#132030',
    '--bg4':    '#1a2d42',
    '--border': '#2a3f58',
    '--text':   '#eef2f7',
    '--text2':  '#7f9ab5',
    '--text3':  '#4a6480',
    '--red':    '#c0392b',
    '--blue':   '#2176ae',
    '--yellow': '#e8a020',
    '--green':  '#1e9e5e',
  };

  function applyTheme(mode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = mode === 'dark' || (mode === 'system' && prefersDark);
    const vars = useDark ? DARK : LIGHT;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', useDark ? 'dark' : 'light');
    // Update any existing toggle buttons
    document.querySelectorAll('[data-theme-toggle]').forEach(el => {
      el.setAttribute('data-current', mode);
      el.querySelector('.theme-icon')?.replaceWith(makeIcon(mode));
    });
  }

  function getMode() {
    return localStorage.getItem(KEY) || 'system';
  }

  function setMode(mode) {
    localStorage.setItem(KEY, mode);
    applyTheme(mode);
  }

  function cycle() {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(getMode()) + 1) % order.length];
    setMode(next);
  }

  function makeIcon(mode) {
    const span = document.createElement('span');
    span.className = 'theme-icon';
    span.style.cssText = 'font-size:14px; line-height:1;';
    span.textContent = mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '⚙';
    return span;
  }

  function makeLabel(mode) {
    return mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System';
  }

  // Render a compact toggle button into an existing container element
  function renderToggle(container) {
    if (!container) return;
    const mode = getMode();
    const btn = document.createElement('button');
    btn.setAttribute('data-theme-toggle', '');
    btn.setAttribute('data-current', mode);
    btn.title = 'Toggle theme';
    btn.style.cssText = `
      display:inline-flex; align-items:center; gap:5px;
      padding:4px 10px; border-radius:6px; border:1px solid var(--border);
      background:transparent; color:var(--text2); font-size:11px;
      font-family:var(--mono, monospace); cursor:pointer; transition:all 0.15s;
    `;
    btn.appendChild(makeIcon(mode));
    const lbl = document.createElement('span');
    lbl.className = 'theme-label';
    lbl.textContent = makeLabel(mode);
    btn.appendChild(lbl);
    btn.addEventListener('click', () => {
      cycle();
      lbl.textContent = makeLabel(getMode());
    });
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--text3)'; btn.style.color = 'var(--text)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text2)'; });
    container.appendChild(btn);
  }

  function init() {
    applyTheme(getMode());
    // React to OS-level changes when in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getMode() === 'system') applyTheme('system');
    });
  }

  return { init, setMode, getMode, cycle, renderToggle };
})();

// Auto-init as soon as the script loads (before body renders) to avoid flash
Theme.init();
