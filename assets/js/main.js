/**
 * main.js — Orchestrator: initializes all modules after DOM is ready.
 */
import { initComponents } from './components.js';
import { initThemeToggle } from './theme-toggle.js';
import { initMobileNav } from './mobile-nav.js';
import { initScrollReveal } from './scroll-reveal.js';
import { initI18n } from './i18n.js';
import { initTracker } from './tracker.js';

async function init() {
  // Silent visitor tracking (fire early, non-blocking)
  initTracker();

  // Theme toggle listens via MutationObserver, so start it before components
  initThemeToggle();
  initMobileNav();

  // Load shared header & footer
  await initComponents();

  // i18n (after components so header/footer are in DOM)
  await initI18n();

  // Scroll reveal (runs after all content is in the DOM)
  initScrollReveal();

  // Comments — only on blog post pages
  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    const { initComments } = await import('./comments.js');
    initComments();
  }

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
