/**
 * i18n.js — Internationalization with JSON translation files.
 *
 * Two mechanisms:
 * 1. data-i18n="key" attributes → text replaced from JSON (UI chrome)
 * 2. data-lang-content="en|zh" elements → shown/hidden via CSS (long-form content)
 */

let translations = {};
let currentLang = 'en';

export async function initI18n() {
  currentLang = detectLanguage();
  document.documentElement.setAttribute('data-lang', currentLang);

  await loadTranslations(currentLang);
  applyTranslations();
  bindLangToggle();
}

function detectLanguage() {
  const saved = localStorage.getItem('lang');
  if (saved) return saved;
  const nav = navigator.language || '';
  return nav.startsWith('zh') ? 'zh' : 'en';
}

async function loadTranslations(lang) {
  const root = document.documentElement.getAttribute('data-root') || '.';
  try {
    const res = await fetch(`${root}/assets/i18n/${lang}.json`);
    translations = await res.json();
  } catch (e) {
    console.warn('i18n: failed to load translations for', lang, e);
    translations = {};
  }
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key] !== undefined) {
      el.textContent = translations[key];
    }
  });

  // Update lang toggle button text
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = currentLang === 'en' ? '\u4e2d' : 'EN';
  }
}

function bindLangToggle() {
  const btn = document.getElementById('lang-toggle');
  if (!btn || btn._bound) return;
  btn._bound = true;

  btn.addEventListener('click', async () => {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    document.documentElement.setAttribute('data-lang', currentLang);
    localStorage.setItem('lang', currentLang);

    await loadTranslations(currentLang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('langchange'));
  });
}
