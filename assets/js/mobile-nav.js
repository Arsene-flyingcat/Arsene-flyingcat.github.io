/**
 * mobile-nav.js — Hamburger menu toggle for mobile viewports.
 */
export function initMobileNav() {
  const observer = new MutationObserver(() => {
    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
      observer.disconnect();
      bindMobileNav(toggle, links);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Try immediately
  const toggle = document.getElementById('mobile-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) bindMobileNav(toggle, links);
}

function bindMobileNav(toggle, links) {
  if (toggle._bound) return;
  toggle._bound = true;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu when a nav link is clicked
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
}
