/**
 * components.js — Fetches and injects shared header/footer HTML fragments.
 * Reads `data-root` from <html> to resolve relative paths.
 */
export async function initComponents() {
  const root = document.documentElement.getAttribute('data-root') || '.';

  const [headerRes, footerRes] = await Promise.all([
    fetch(`${root}/assets/components/header.html`),
    fetch(`${root}/assets/components/footer.html`),
  ]);

  const headerHTML = (await headerRes.text()).replaceAll('{root}', root);
  const footerHTML = (await footerRes.text()).replaceAll('{root}', root);

  // Inject header
  const headerSlot = document.getElementById('header-slot');
  if (headerSlot) {
    headerSlot.innerHTML = headerHTML;
  }

  // Inject footer
  const footerSlot = document.getElementById('footer-slot');
  if (footerSlot) {
    footerSlot.innerHTML = footerHTML;
  }

  // Highlight active nav link
  highlightActiveNav();
}

function highlightActiveNav() {
  const page = document.documentElement.getAttribute('data-page');
  if (!page) return;

  const links = document.querySelectorAll('.nav-links a[data-page]');
  links.forEach((link) => {
    if (link.getAttribute('data-page') === page) {
      link.classList.add('active');
    }
  });
}
