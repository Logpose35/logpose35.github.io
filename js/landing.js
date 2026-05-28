// ===== LOGPOSE — Page d'accueil =====

// ---- Thème (partagé avec le jeu via localStorage 'op-theme') ----
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('land-theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  lsSet('op-theme', next);
}
(function initTheme() {
  const saved = lsGet('op-theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();

// ---- Statistiques globales (Firebase) ----
const FB_URL = 'https://logpose-eec08-default-rtdb.europe-west1.firebasedatabase.app';
const MODES = ['classic', 'wanted', 'flag', 'fruit', 'emoji', 'audio'];

function parisNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}
function todayKey() {
  const d = parisNow();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function fbGet(path) {
  try {
    const res = await fetch(`${FB_URL}/${path}.json`);
    return await res.json();
  } catch { return null; }
}

function animateCount(el, target) {
  if (!el) return;
  const dur = 1200;
  const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(eased * target).toLocaleString('fr-FR');
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = target.toLocaleString('fr-FR');
  }
  requestAnimationFrame(frame);
}

async function loadGlobalStats() {
  const dayData = await fbGet(`counters/${todayKey()}`);
  let todayTotal = 0;
  if (dayData && typeof dayData === 'object') {
    for (const m of MODES) {
      const v = Number(dayData[m]);
      if (Number.isFinite(v) && v > 0) todayTotal += Math.floor(v);
    }
  }
  animateCount(document.getElementById('stat-today'), todayTotal);
}

// ---- Animations au scroll ----
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(e => e.classList.add('in'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  els.forEach(e => obs.observe(e));
}

// ---- Service Worker ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  loadGlobalStats();
});
