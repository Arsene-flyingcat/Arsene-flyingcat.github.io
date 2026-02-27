/**
 * tracker.js — Silent visitor tracking. One beacon per page per session.
 */
const TRACK_URL = 'https://comments.arsenelee.com/api/track';

export function initTracker() {
  const page = location.pathname;
  const key = `_t:${page}`;
  if (sessionStorage.getItem(key)) return;

  const data = JSON.stringify({ page });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(TRACK_URL, new Blob([data], { type: 'text/plain' }));
  } else {
    fetch(TRACK_URL, {
      method: 'POST',
      body: data,
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
    }).catch(() => {});
  }

  sessionStorage.setItem(key, '1');
}
