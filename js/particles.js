const particles = [];

function generateBlobVerts(count = 6) {
  const verts = [];
  for (let i = 0; i < count; i++) {
    verts.push({
      angle: (i / count) * Math.PI * 2,
      radiusMul: 0.7 + Math.random() * 0.5,
    });
  }
  return verts;
}

export function emit(x, y, { count = 12, color = '#fff', speed = 300, gravity = 400, radius = 4, lifetime = 0.7, shape = 'circle' } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    let r = radius * (0.5 + Math.random() * 0.7);
    // Rare oversized chunk for visual variety
    if (shape === 'chunk' && Math.random() < 0.08) r *= 2.5 + Math.random() * 1.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s - speed * 0.3,
      gravity,
      radius: r,
      color,
      life: lifetime,
      maxLife: lifetime,
      shape,
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: shape === 'chunk' ? (Math.random() - 0.5) * 10 : 0,
      blobVerts: shape === 'chunk' ? generateBlobVerts() : null,
    });
  }
}

export function update(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.angularVelocity * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function draw(ctx) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.shape === 'chunk') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Organic blob chunk: smooth a closed curve through jittered-radius
      // vertices by quadratic-curving toward each edge's midpoint.
      const verts = p.blobVerts.map(v => ({
        x: Math.cos(v.angle) * p.radius * v.radiusMul,
        y: Math.sin(v.angle) * p.radius * v.radiusMul,
      }));
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      ctx.beginPath();
      const startMid = mid(verts[verts.length - 1], verts[0]);
      ctx.moveTo(startMid.x, startMid.y);
      for (let i = 0; i < verts.length; i++) {
        const next = verts[(i + 1) % verts.length];
        const m = mid(verts[i], next);
        ctx.quadraticCurveTo(verts[i].x, verts[i].y, m.x, m.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function clear() {
  particles.length = 0;
}
