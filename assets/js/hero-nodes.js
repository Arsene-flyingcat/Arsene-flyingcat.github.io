/**
 * hero-nodes.js — Animated network of connected nodes for the hero section.
 * Particles drift around and connect with lines when close enough.
 */
export function initHeroNodes(canvas) {
  const ctx = canvas.getContext('2d');
  const CONNECT_DIST = 150;
  const MOUSE_DIST = 200;
  let width, height;
  let particles = [];
  let mouse = { x: -9999, y: -9999 };
  let animId = null;

  // Colors that match the brand palette
  const NODE_COLORS = [
    'rgba(108, 60, 225, 0.8)',   // primary violet
    'rgba(168, 85, 247, 0.8)',   // light purple
    'rgba(6, 182, 212, 0.7)',    // cyan
    'rgba(244, 114, 182, 0.7)',  // pink
    'rgba(251, 146, 60, 0.6)',   // orange
  ];

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
        color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      });
    }
  }

  function update() {
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

      // Dampen velocity
      p.vx *= 0.999;
      p.vy *= 0.999;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

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
          ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
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
        ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Subtle glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
      glow.addColorStop(0, p.color.replace(/[\d.]+\)$/, '0.15)'));
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
