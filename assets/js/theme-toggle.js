/**
 * theme-toggle.js — Dark / light mode with localStorage persistence.
 */
export function initThemeToggle() {
  // Apply saved theme immediately (also handled in inline script for FOUC prevention)
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  // Wait for header to be injected, then bind toggle
  const observer = new MutationObserver(() => {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      observer.disconnect();
      bindToggle(btn);
      updateIcons();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately in case header is already there
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    bindToggle(btn);
    updateIcons();
  }
}

function bindToggle(btn) {
  if (btn._bound) return;
  btn._bound = true;

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcons();
  });
}

function updateIcons() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const sun = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (sun) sun.style.display = isDark ? 'block' : 'none';
  if (moon) moon.style.display = isDark ? 'none' : 'block';
}
