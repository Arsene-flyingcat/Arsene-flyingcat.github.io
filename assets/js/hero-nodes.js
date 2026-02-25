/**
 * hero-nodes.js — Animated network of connected nodes for the hero section.
 * Particles drift around and connect with lines when close enough.
 * Easter egg: gather all nodes near cursor → confetti → scatter.
 */
export function initHeroNodes(canvas) {
  const ctx = canvas.getContext('2d');
  const CONNECT_DIST = 150;
  const MOUSE_DIST = 200;
  const GATHER_DIST = 60;
  let width, height;
  let particles = [];
  let mouse = { x: -9999, y: -9999 };
  let animId = null;
  let confetti = [];
  let confettiActive = false;
  let confettiStart = 0;
  const CONFETTI_DURATION = 3000;

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // Dark mode: vibrant colored nodes on dark background
  const DARK_NODES = [
    'rgba(168, 85, 247, 0.9)',   // purple
    'rgba(6, 182, 212, 0.8)',    // cyan
    'rgba(244, 114, 182, 0.8)',  // pink
    'rgba(251, 146, 60, 0.7)',   // orange
    'rgba(129, 140, 248, 0.8)',  // indigo
  ];
  // Light mode: solid dark nodes on colorful gradient for contrast
  const LIGHT_NODES = [
    'rgba(30, 20, 60, 0.6)',
    'rgba(30, 20, 60, 0.5)',
    'rgba(30, 20, 60, 0.55)',
    'rgba(30, 20, 60, 0.5)',
    'rgba(30, 20, 60, 0.6)',
  ];
  const CONFETTI_COLORS = ['#A855F7', '#06B6D4', '#F472B6', '#FB923C', '#10B981', '#818CF8', '#FBBF24'];

  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    // ~1 particle per 8000px² of area, min 40 max 120
    const count = Math.max(40, Math.min(120, Math.floor((width * height) / 8000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1.5,
        colorIndex: Math.floor(Math.random() * DARK_NODES.length),
      });
    }
  }

  // ── Confetti ──────────────────────────────────────────────────

  function launchConfetti() {
    confettiActive = true;
    confettiStart = performance.now();
    confetti = [];
    const cx = mouse.x > 0 ? mouse.x : width / 2;
    const cy = mouse.y > 0 ? mouse.y : height / 3;
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      confetti.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: Math.random() * 6 + 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  function updateConfetti() {
    for (const c of confetti) {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.12; // gravity
      c.vx *= 0.99;
      c.rotation += c.rotSpeed;
    }
    if (performance.now() - confettiStart > CONFETTI_DURATION) {
      confettiActive = false;
      confetti = [];
      createParticles(); // scatter new nodes
    }
  }

  function drawConfetti() {
    const elapsed = performance.now() - confettiStart;
    const fadeOut = elapsed > CONFETTI_DURATION - 500
      ? 1 - (elapsed - (CONFETTI_DURATION - 500)) / 500
      : 1;

    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, fadeOut);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── Physics ───────────────────────────────────────────────────

  function update() {
    if (confettiActive) {
      updateConfetti();
      return;
    }

    let allGathered = mouse.x > 0 && particles.length > 0;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Bounce off edges softly
      if (p.x < 0)     { p.x = 0;     p.vx *= -1; }
      if (p.x > width)  { p.x = width;  p.vx *= -1; }
      if (p.y < 0)     { p.y = 0;     p.vy *= -1; }
      if (p.y > height) { p.y = height; p.vy *= -1; }

      // Slight attraction toward mouse
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_DIST && dist > 0) {
        p.vx += dx / dist * 0.02;
        p.vy += dy / dist * 0.02;
      }

      // Check if this node is near cursor
      if (dist > GATHER_DIST) {
        allGathered = false;
      }

      // Ambient drift — gentle wandering even without mouse
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;

      // Clamp speed so nodes don't fly too fast
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = 0.8;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }
    }

    if (allGathered) {
      launchConfetti();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  function draw() {
    ctx.clearRect(0, 0, width, height);

    if (confettiActive) {
      drawConfetti();
      return;
    }

    const dark = isDark();
    const nodeColors = dark ? DARK_NODES : LIGHT_NODES;
    const lineRGB = dark ? '168, 85, 247' : '30, 20, 60';

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECT_DIST) {
          const opacity = (1 - dist / CONNECT_DIST) * 0.35;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${lineRGB}, ${opacity})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw mouse connections
    for (const p of particles) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_DIST) {
        const opacity = (1 - dist / MOUSE_DIST) * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(${lineRGB}, ${opacity})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const p of particles) {
      const color = nodeColors[p.colorIndex];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Subtle glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
      glow.addColorStop(0, color.replace(/[\d.]+\)$/, '0.2)'));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fill();
    }
  }

  function frame() {
    update();
    draw();
    animId = requestAnimationFrame(frame);
  }

  // Mouse tracking
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Handle resize
  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    resize();
    createParticles();
    draw();
    return;
  }

  resize();
  createParticles();
  frame();
}
