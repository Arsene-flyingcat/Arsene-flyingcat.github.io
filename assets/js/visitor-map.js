/**
 * visitor-map.js — Pixel-art world map on <canvas>.
 *
 * Flow:
 * 1. Draw pixel world map from simplified continent coordinate data
 * 2. Fetch visitor's approximate location via ip-api.com
 * 3. Store location in Firebase Realtime Database (if configured)
 * 4. Read all stored visitors and plot glowing dots
 *
 * Works without Firebase — falls back to showing just the current visitor.
 */

// ── Simplified continent outlines (pixel grid coordinates) ──────────
// Map is drawn on a conceptual 160×80 grid, then scaled to canvas.
// Each continent is an array of [x, y, width, height] rectangles.
const CONTINENTS = [
  // North America
  [[35,8,3,2],[33,10,8,2],[30,12,14,2],[28,14,16,3],[28,17,14,3],[30,20,12,3],[32,23,10,2],[34,25,8,3],[36,28,4,2],[38,28,3,3],[40,30,2,2]],
  // South America
  [[42,38,6,2],[40,40,8,3],[39,43,8,3],[39,46,7,3],[40,49,6,3],[41,52,5,3],[42,55,4,2],[43,57,3,3],[44,60,2,2],[44,62,2,2]],
  // Europe
  [[75,10,4,2],[73,12,8,2],[72,14,10,2],[74,16,8,2],[76,18,6,2],[73,20,10,2],[75,22,6,2]],
  // Africa
  [[74,28,8,2],[72,30,12,2],[71,32,14,3],[72,35,12,3],[73,38,10,3],[74,41,8,3],[75,44,6,3],[76,47,5,2],[77,49,4,2],[78,51,2,2]],
  // Asia
  [[85,8,12,2],[82,10,18,2],[80,12,22,3],[82,15,20,3],[84,18,18,3],[86,21,16,2],[88,23,14,3],[90,26,10,2],[92,28,8,2],[94,30,4,2],[88,28,4,2],[85,26,4,2],[84,24,3,2],[100,18,6,3],[104,16,4,2],[106,18,3,3],[108,20,2,2]],
  // Southeast Asia / Indonesia (real coords: ~100-140°E)
  [[122,30,6,2],[124,32,4,3],[125,35,3,3],[126,38,2,3],[133,33,3,3],[128,39,6,2],[124,42,6,2],[128,43,6,2]],
  // Australia (real coords: ~113-154°E)
  [[134,46,12,2],[132,48,16,3],[132,51,14,3],[134,54,10,2],[136,56,6,2]],
  // Greenland
  [[48,4,6,2],[47,6,8,3],[48,9,6,2]],
  // UK / Ireland
  [[70,12,2,2],[68,13,2,2]],
  // Japan (real coords: ~130-145°E, Hokkaido to Okinawa)
  [[142,21,2,2],[141,23,3,2],[140,25,2,3],[139,28,2,2]],
  // New Zealand (real coords: ~174°E)
  [[156,55,2,2],[156,57,2,3]],
  // Scandinavia (Norway/Sweden/Finland)
  [[78,6,2,2],[79,8,3,3]],
  // Iberian Peninsula (Spain/Portugal)
  [[71,24,4,3]],
  // Italian Peninsula
  [[78,24,2,4]],
  // Arabian Peninsula (real coords: ~40-55°E)
  [[96,26,4,2],[96,28,6,3],[98,31,4,2]],
  // Indian Subcontinent (real coords: ~73-88°E)
  [[112,26,8,2],[113,28,6,3],[114,31,4,3],[115,34,2,3]],
  // Korean Peninsula (real coords: ~127°E)
  [[136,22,2,5]],
  // Central America
  [[38,32,3,2],[39,34,3,2],[40,36,2,2]],
  // Iceland
  [[63,7,3,2]],
  // Madagascar (real coords: ~47°E)
  [[101,47,2,4]],
  // Taiwan (real coords: ~121°E)
  [[134,29,2,2]],
  // Sri Lanka (real coords: ~80°E)
  [[116,37,2,2]],
  // Russia / Siberia (eastward extension beyond main Asia block)
  [[97,6,16,2],[113,6,14,2],[127,7,10,2],[97,8,26,2],[123,8,14,2],[100,10,24,3],[124,10,12,2],[102,13,20,2],[122,13,12,2],[128,15,8,3],[132,18,6,3],[137,7,6,3],[136,10,6,3],[134,13,6,2],[142,10,6,3],[146,12,3,5]],
  // China + Mongolia (x=108-136, connecting Asia block to Korea)
  [[108,17,10,2],[118,17,14,3],[118,20,6,3],[124,20,12,3],[120,23,6,3],[126,23,10,3],[122,26,12,3],[126,29,6,3],[128,32,4,2]],
];

// ── Color palette ─────────────────────────────────────────────────
const COLORS = {
  land:      { light: '#D1C4E9', dark: '#3D3560' },
  ocean:     { light: '#F5F3FF', dark: '#161228' },
  grid:      { light: '#EDE7F6', dark: '#1E1B2E' },
  dotInner:  ['#A855F7', '#06B6D4', '#F472B6', '#FB923C'],
  dotGlow:   'rgba(168, 85, 247, 0.4)',
};

// ── Firebase config placeholder ────────────────────────────────────
// Replace with your Firebase project config to enable persistence.
// Leave as null to run in local-only mode (shows only current visitor).
const FIREBASE_CONFIG = null;
/*
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
*/

let db = null;
let pixelSize = 5;
let visitors = [];
let animFrame = null;

export function initVisitorMap(canvas) {
  const ctx = canvas.getContext('2d');
  resize(canvas);
  window.addEventListener('resize', () => resize(canvas));

  drawMap(ctx, canvas);

  // Fetch total visitor count
  fetchTotalVisitors().then(total => {
    updateTotalCount(total);
    document.addEventListener('langchange', () => updateTotalCount(total));
  });

  // Fetch current visitor location
  fetchVisitorLocation().then(async (loc) => {
    if (loc) {
      // Try Firebase if configured
      if (FIREBASE_CONFIG) {
        await initFirebase();
        await storeVisitor(loc);
        visitors = await loadVisitors();
      } else {
        visitors = [loc];
      }
      drawMap(ctx, canvas);
      animateDots(ctx, canvas);
    }
  }).catch((err) => {
    console.warn('Visitor map error:', err);
  });
}

function resize(canvas) {
  const wrapper = canvas.parentElement;
  const w = Math.min(wrapper.clientWidth, 800);
  const h = w * 0.5;
  canvas.width = w;
  canvas.height = h;
  pixelSize = Math.max(2, Math.floor(w / 160));
}

// ── Draw the pixel world map ───────────────────────────────────────
function drawMap(ctx, canvas) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const w = canvas.width;
  const h = canvas.height;
  const ps = pixelSize;

  // Background
  ctx.fillStyle = isDark ? COLORS.ocean.dark : COLORS.ocean.light;
  ctx.fillRect(0, 0, w, h);

  // Grid dots
  ctx.fillStyle = isDark ? COLORS.grid.dark : COLORS.grid.light;
  for (let x = 0; x < w; x += ps * 2) {
    for (let y = 0; y < h; y += ps * 2) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Scale factors from conceptual 160×80 grid to canvas
  const sx = w / 160;
  const sy = h / 80;

  // Draw continents
  ctx.fillStyle = isDark ? COLORS.land.dark : COLORS.land.light;
  for (const continent of CONTINENTS) {
    for (const [cx, cy, cw, ch] of continent) {
      // Draw each rect as pixel blocks
      const rx = Math.floor(cx * sx);
      const ry = Math.floor(cy * sy);
      const rw = Math.ceil(cw * sx);
      const rh = Math.ceil(ch * sy);
      for (let px = rx; px < rx + rw; px += ps) {
        for (let py = ry; py < ry + rh; py += ps) {
          ctx.fillRect(px, py, ps - 1, ps - 1);
        }
      }
    }
  }

  // Draw visitor dots
  for (let i = 0; i < visitors.length; i++) {
    drawDot(ctx, canvas, visitors[i], i);
  }
}

function drawDot(ctx, canvas, visitor, index) {
  const x = lonToX(visitor.lon, canvas.width);
  const y = latToY(visitor.lat, canvas.height);
  const color = COLORS.dotInner[index % COLORS.dotInner.length];
  const ps = pixelSize;

  // Glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = ps * 3;
  ctx.fillStyle = color;
  ctx.fillRect(x - ps, y - ps, ps * 2, ps * 2);
  ctx.restore();

  // Bright center
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - Math.floor(ps / 2), y - Math.floor(ps / 2), ps, ps);
}

// ── Dot pulse animation ─────────────────────────────────────────
function animateDots(ctx, canvas) {
  let t = 0;
  function frame() {
    t += 0.02;
    drawMap(ctx, canvas);

    // Animated glow rings
    for (let i = 0; i < visitors.length; i++) {
      const v = visitors[i];
      const x = lonToX(v.lon, canvas.width);
      const y = latToY(v.lat, canvas.height);
      const color = COLORS.dotInner[i % COLORS.dotInner.length];
      const pulse = Math.sin(t + i) * 0.5 + 0.5;
      const radius = pixelSize * 3 + pulse * pixelSize * 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3 * (1 - pulse);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    animFrame = requestAnimationFrame(frame);
  }
  if (animFrame) cancelAnimationFrame(animFrame);
  frame();
}

// ── Coordinate conversion (Mercator-ish) ────────────────────────
function lonToX(lon, width) {
  return ((lon + 180) / 360) * width;
}

function latToY(lat, height) {
  // Simple equirectangular
  return ((90 - lat) / 180) * height;
}

// ── IP Geolocation (tries multiple free APIs as fallback) ───────
async function fetchVisitorLocation() {
  const apis = [
    {
      url: 'https://ipwho.is/',
      parse: (d) => d.success ? { lat: d.latitude, lon: d.longitude, country: d.country, city: d.city, ts: Date.now() } : null,
    },
    {
      url: 'https://get.geojs.io/v1/ip/geo.json',
      parse: (d) => d.latitude ? { lat: parseFloat(d.latitude), lon: parseFloat(d.longitude), country: d.country, city: d.city, ts: Date.now() } : null,
    },
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(api.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const loc = api.parse(data);
      if (loc) return loc;
    } catch (e) {
      console.warn(`Visitor map: ${api.url} failed`, e);
    }
  }

  // Last resort: try JSONP-style via script tag for ip-api.com
  try {
    const loc = await new Promise((resolve, reject) => {
      const cb = '_geoCallback' + Date.now();
      const timeout = setTimeout(() => { delete window[cb]; reject('timeout'); }, 5000);
      window[cb] = (data) => {
        clearTimeout(timeout);
        delete window[cb];
        if (data.status === 'success') {
          resolve({ lat: data.lat, lon: data.lon, country: data.country, city: data.city, ts: Date.now() });
        } else {
          reject('failed');
        }
      };
      const s = document.createElement('script');
      s.src = `http://ip-api.com/json/?callback=${cb}&fields=status,lat,lon,country,city`;
      s.onerror = () => { clearTimeout(timeout); delete window[cb]; reject('script error'); };
      document.head.appendChild(s);
    });
    if (loc) return loc;
  } catch (e) {
    console.warn('Visitor map: JSONP fallback failed', e);
  }

  return null;
}

// ── Firebase helpers ────────────────────────────────────────────
async function initFirebase() {
  if (db) return;
  try {
    // Dynamically load Firebase from CDN
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');
    /* global firebase */
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch (e) {
    console.warn('Visitor map: Firebase init failed', e);
  }
}

async function storeVisitor(loc) {
  if (!db) return;
  try {
    await db.ref('visitors').push({
      lat: loc.lat,
      lon: loc.lon,
      country: loc.country || '',
      city: loc.city || '',
      ts: Date.now(),
    });
  } catch (e) {
    console.warn('Visitor map: could not store visitor', e);
  }
}

async function loadVisitors() {
  if (!db) return [];
  try {
    const snap = await db.ref('visitors').orderByChild('ts').limitToLast(200).once('value');
    const data = snap.val();
    if (!data) return [];
    return Object.values(data);
  } catch (e) {
    console.warn('Visitor map: could not load visitors', e);
    return [];
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Total visitor counter (persistent via free API) ─────────────
// Only increments once per browser session to avoid inflating counts on refresh.
async function fetchTotalVisitors() {
  const alreadyCounted = sessionStorage.getItem('visitor_counted');

  if (alreadyCounted) {
    return parseInt(localStorage.getItem('totalVisitorCount') || '0', 10);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.counterapi.dev/v1/arsene-flyingcat-github-io/visits/up', {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const count = data.count || 0;
      localStorage.setItem('totalVisitorCount', String(count));
      sessionStorage.setItem('visitor_counted', '1');
      return count;
    }
  } catch (e) {
    console.warn('Visitor counter API failed:', e);
  }
  return parseInt(localStorage.getItem('totalVisitorCount') || '0', 10);
}

function updateTotalCount(count) {
  const el = document.getElementById('total-visitors');
  if (!el || count <= 0) return;
  const lang = document.documentElement.getAttribute('data-lang') || 'en';
  if (lang === 'zh') {
    el.innerHTML = `已有 <strong>${count.toLocaleString()}</strong> 位朋友到访过，感谢每一次相遇`;
  } else {
    el.innerHTML = `<strong>${count.toLocaleString()}</strong> friends have visited — thanks for being one of them!`;
  }
}
