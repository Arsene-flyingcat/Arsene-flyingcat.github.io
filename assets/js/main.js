/**
 * main.js — Orchestrator: initializes all modules after DOM is ready.
 */
import { initComponents } from './components.js';
import { initThemeToggle } from './theme-toggle.js';
import { initMobileNav } from './mobile-nav.js';
import { initScrollReveal } from './scroll-reveal.js';

async function init() {
  // Theme toggle listens via MutationObserver, so start it before components
  initThemeToggle();
  initMobileNav();

  // Load shared header & footer
  await initComponents();

  // Scroll reveal (runs after all content is in the DOM)
  initScrollReveal();

  // Hero node network — only on the home page
  const heroCanvas = document.getElementById('hero-nodes-canvas');
  if (heroCanvas) {
    const { initHeroNodes } = await import('./hero-nodes.js');
    initHeroNodes(heroCanvas);
  }

  // Visitor map — only on the home page
  const mapCanvas = document.getElementById('visitor-map-canvas');
  if (mapCanvas) {
    const { initVisitorMap } = await import('./visitor-map.js');
    initVisitorMap(mapCanvas);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
