import { centerOf } from './physics.js';

export class RoomRenderer {
  constructor(canvas, room) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.room = room;
    this.particles = [];
    this.rings = [];
    this.trails = false;
    this.hover = null;
    this.selected = null;
    this.tool = 'grab';
    this.pointer = null;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(point, color, count = 24) {
    this.rings.push({ ...point, radius: 8, life: 1, color });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 6;
      this.particles.push({ ...point, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, life: 0.6 + Math.random() * 0.5, size: 2 + Math.random() * 3 });
    }
  }

  softPath(e) {
    const ctx = this.ctx, nodes = e.nodes;
    const points = nodes.map((b, i) => {
      const a = nodes[(i - 1 + nodes.length) % nodes.length].position, c = nodes[(i + 1) % nodes.length].position;
      const dx = c.y - a.y, dy = a.x - c.x, l = Math.hypot(dx, dy) || 1;
      return { x: b.position.x + dx / l * e.nodeRadius * 0.9, y: b.position.y + dy / l * e.nodeRadius * 0.9 };
    });
    ctx.beginPath();
    ctx.moveTo((points[0].x + points.at(-1).x) / 2, (points[0].y + points.at(-1).y) / 2);
    points.forEach((p, i) => { const next = points[(i + 1) % points.length]; ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2); });
    ctx.closePath();
    return points;
  }

  drawSoft(e) {
    const ctx = this.ctx, c = centerOf(e), r = e.radius;
    const ys = e.nodes.map(n => n.position.y), xs = e.nodes.map(n => n.position.x);
    const sy = Math.min(1.3, (Math.max(...ys) - Math.min(...ys) + e.nodeRadius * 2) / (r * 2));
    const sx = Math.min(1.8, (Math.max(...xs) - Math.min(...xs) + e.nodeRadius * 2) / (r * 2));
    ctx.save();
    const grad = ctx.createLinearGradient(c.x - r, c.y - r, c.x + r, c.y + r);
    grad.addColorStop(0, lighten(e.mat.color, 0.23)); grad.addColorStop(1, e.mat.color);
    this.softPath(e);
    ctx.shadowColor = `${e.mat.dark}20`; ctx.shadowBlur = 7; ctx.shadowOffsetY = 5;
    ctx.fillStyle = grad; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = `${e.mat.dark}b0`; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.save(); this.softPath(e); ctx.clip();
    ctx.fillStyle = '#ffffff45';
    ctx.beginPath(); ctx.ellipse(c.x - r * 0.29 * sx, c.y - r * 0.45 * sy, r * 0.22, r * 0.09 * Math.max(0.5, sy), -0.65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff25'; ctx.beginPath(); ctx.arc(c.x - r * 0.49 * sx, c.y - r * 0.2 * sy, r * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.translate(c.x, c.y); ctx.scale(Math.min(sx, 1.4), Math.max(0.42, sy));
    const eyeY = -r * 0.06, eyeX = r * 0.20, er = r * 0.042;
    const look = this.pointer ? Math.max(-2, Math.min(2, (this.pointer.x - c.x) / 90)) : 0;
    const blink = Math.sin(e.age * 1.8 + e.id * 4) > 0.998;
    ctx.fillStyle = '#37474ed9';
    for (const x of [-eyeX, eyeX]) {
      ctx.beginPath(); ctx.ellipse(x + look, eyeY, er, blink ? er * 0.15 : er * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#37474eb0'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    if (sy < 0.62) { ctx.moveTo(-r * 0.09, r * 0.19); ctx.lineTo(r * 0.09, r * 0.19); }
    else ctx.arc(0, r * 0.08, r * 0.12, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.fillStyle = '#fff0f033';
    for (const x of [-r * 0.32, r * 0.32]) { ctx.beginPath(); ctx.ellipse(x, r * 0.12, r * 0.1, r * 0.048, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  drawRigid(e, now) {
    const ctx = this.ctx, b = e.nodes[0], { mat, size, radius: r, kind } = e;
    ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    ctx.fillStyle = mat.color; ctx.strokeStyle = mat.dark; ctx.lineWidth = 1.2;
    if (r) {
      const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 1, 0, 0, r * 1.4);
      g.addColorStop(0, lighten(mat.color, 0.48)); g.addColorStop(1, kind === 'steel' ? '#859397' : mat.color);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (kind === 'bouncy') {
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.clip();
        ctx.strokeStyle = '#fff5c08f'; ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r * 1.3, 0.4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (kind === 'bumper') {
        ctx.save(); ctx.rotate(now * 0.0002); ctx.strokeStyle = '#fff4c4'; ctx.lineWidth = 3; ctx.setLineDash([3, 8]);
        ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.moveTo(3, -15); ctx.lineTo(-9, 3); ctx.lineTo(0, 3); ctx.lineTo(-3, 15); ctx.lineTo(10, -5); ctx.lineTo(1, -5); ctx.closePath(); ctx.fill();
        if (b.plugin.flash > 0.05) { ctx.globalAlpha = b.plugin.flash; ctx.strokeStyle = '#edb140'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r + 12 * (1 - b.plugin.flash), 0, Math.PI * 2); ctx.stroke(); }
      }
    } else {
      const w = mat.width * size, h = mat.height * size;
      if (kind === 'trampoline') {
        ctx.strokeStyle = '#659274'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-w * 0.37, h / 2); ctx.lineTo(-w * 0.37, h / 2 + 12); ctx.moveTo(w * 0.37, h / 2); ctx.lineTo(w * 0.37, h / 2 + 12); ctx.stroke();
      }
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, kind === 'pin' ? 10 : 5); ctx.fill(); ctx.stroke();
      if (kind === 'crate' || kind === 'plank') {
        ctx.strokeStyle = '#9d774843'; ctx.lineWidth = 1;
        for (let y = -h / 2 + 9; y < h / 2 - 3; y += 13) { ctx.beginPath(); ctx.moveTo(-w / 2 + 5, y); ctx.bezierCurveTo(-w / 4, y + 3, w / 6, y - 2, w / 2 - 5, y + 1); ctx.stroke(); }
        if (kind === 'crate') {
          ctx.strokeStyle = '#b38c5d'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(-w / 2 + 6, -h / 2 + 6); ctx.lineTo(w / 2 - 6, h / 2 - 6); ctx.moveTo(w / 2 - 6, -h / 2 + 6); ctx.lineTo(-w / 2 + 6, h / 2 - 6); ctx.stroke();
        }
        ctx.fillStyle = '#8d74519a';
        for (const x of [-w / 2 + 5, w / 2 - 5]) for (const y of [-h / 2 + 5, h / 2 - 5]) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
      }
      if (kind === 'ramp' || kind === 'trampoline') {
        ctx.strokeStyle = '#ffffff8a'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(-w / 2 + 9, -h / 2 + 5); ctx.lineTo(w / 2 - 9, -h / 2 + 5); ctx.stroke(); ctx.setLineDash([]);
      }
      if (kind === 'pin') { ctx.fillStyle = '#e48479'; ctx.fillRect(-w / 2 + 1, -h / 2 + 17, w - 2, 7); }
      if (kind === 'fan') {
        ctx.fillStyle = '#d4e4de'; ctx.beginPath(); ctx.arc(0, 0, 17 * size, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.rotate(now * 0.008);
        ctx.fillStyle = '#7fa9a6';
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(19 * size, -17 * size, 18 * size, 11 * size, 0, 0); ctx.fill(); } ctx.restore();
      }
      if (kind === 'magnet') {
        ctx.fillStyle = '#f8f8f1'; ctx.beginPath(); ctx.roundRect(-w * 0.21, -h / 2 - 1, w * 0.42, h * 0.64, [0, 0, 10, 10]); ctx.fill();
        ctx.fillStyle = '#b4c5cf'; ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w * 0.28, 12); ctx.fillRect(w * 0.22, -h / 2 + 1, w * 0.28 - 1, 12);
      }
    }
    ctx.restore();
  }

  draw(now, dt) {
    const { ctx, room } = this, w = room.width, h = room.height;
    ctx.clearRect(0, 0, w, h);
    // A small floor ruler makes the whole canvas feel like one physical room.
    ctx.strokeStyle = '#a7a99b55'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 20; x < w; x += 20) { ctx.moveTo(x, h); ctx.lineTo(x, h - (x % 100 === 0 ? 9 : 4)); }
    ctx.stroke();
    for (const e of room.entities) {
      const c = centerOf(e), size = e.radius || e.mat.width * e.size * 0.45;
      const altitude = Math.max(0, h - c.y - size);
      ctx.fillStyle = `rgba(83,77,58,${Math.max(0.018, 0.085 - altitude / 4000)})`;
      ctx.beginPath(); ctx.ellipse(c.x + 4, h - 4, size * (0.65 + altitude / 700), Math.max(2, 5 - altitude / 180), 0, 0, Math.PI * 2); ctx.fill();
      if (this.trails && !e.fixed) {
        if (Math.floor(now / 35) !== e.lastTrail) { e.trail.push({ ...c }); if (e.trail.length > 28) e.trail.shift(); e.lastTrail = Math.floor(now / 35); }
        ctx.lineWidth = 2.5;
        for (let i = 1; i < e.trail.length; i++) { ctx.strokeStyle = `${e.mat.color}${Math.floor(i / e.trail.length * 110).toString(16).padStart(2, '0')}`; ctx.beginPath(); ctx.moveTo(e.trail[i - 1].x, e.trail[i - 1].y); ctx.lineTo(e.trail[i].x, e.trail[i].y); ctx.stroke(); }
      } else e.trail.length = 0;
    }
    for (const e of room.entities) if (e.fixed) this.drawRigid(e, now);
    for (const e of room.entities) if (!e.fixed) e.mat.soft ? this.drawSoft(e) : this.drawRigid(e, now);
    const highlight = this.selected || this.hover;
    if (highlight && room.entities.includes(highlight)) {
      ctx.save(); ctx.strokeStyle = this.tool === 'erase' ? '#d46959' : '#e48055'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      const c = centerOf(highlight), r = highlight.radius || Math.max(highlight.mat.width, highlight.mat.height) * highlight.size / 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (room.grab?.joint) {
      const g = room.grab, p = g.joint.bodyB.position;
      ctx.strokeStyle = '#df865c88'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(g.point.x, g.point.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    }
    if (room.press) {
      const p = room.press, r = p.entity.radius;
      ctx.save(); ctx.strokeStyle = '#b3704e'; ctx.fillStyle = '#e8b88d66'; ctx.lineWidth = 1.5;
      for (const jaw of p.jaws) { ctx.beginPath(); ctx.roundRect(jaw.position.x - r * 2.4, jaw.position.y - 7, r * 4.8, 14, 5); ctx.fill(); ctx.stroke(); }
      const x = p.center.x - 46, y = Math.min(h - 30, p.center.y + r + 34);
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(x - 8, y - 12, 108, 31, 9); ctx.fill();
      ctx.fillStyle = '#d8cbb8'; ctx.fillRect(x, y + 3, 92, 4); ctx.fillStyle = '#eb784a'; ctx.fillRect(x, y + 3, 92 * p.charge, 4);
      ctx.font = 'bold 9px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`SQUISH POWER ${Math.round(p.charge * 100)}%`, p.center.x, y - 1);
      const dx = p.origin.x - p.point.x, dy = p.origin.y - p.point.y;
      const len = Math.hypot(dx, dy); const dir = len > 26 ? { x: dx / len, y: dy / len } : { x: 0, y: -1 };
      const end = { x: p.center.x + dir.x * (70 + p.charge * 70), y: p.center.y + dir.y * (70 + p.charge * 70) };
      ctx.strokeStyle = '#e48055'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(p.center.x, p.center.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
      const angle = Math.atan2(dir.y, dir.x); ctx.translate(end.x, end.y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(0, 0); ctx.lineTo(-10, 5); ctx.stroke(); ctx.restore();
    }
    const decay = Math.min(dt, 0.05);
    for (const p of this.particles) {
      p.life -= decay * 1.6; p.x += p.vx * decay * 60; p.y += p.vy * decay * 60; p.vy += decay * 8;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const ring of this.rings) {
      ring.life -= decay * 2; ring.radius += decay * 200;
      ctx.globalAlpha = Math.max(0, ring.life * 0.6); ctx.strokeStyle = ring.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2); ctx.stroke();
    }
    this.rings = this.rings.filter(r => r.life > 0); ctx.globalAlpha = 1;
    for (const e of room.entities.filter(e => e.kind === 'fan')) {
      const c = e.nodes[0].position;
      ctx.strokeStyle = '#8cafaa66'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const offset = (now * 0.065 + i * 57) % 280;
        const x = c.x + (i % 3 - 1) * 19;
        ctx.beginPath(); ctx.moveTo(x, c.y - 30 - offset); ctx.quadraticCurveTo(x + 8, c.y - 40 - offset, x, c.y - 54 - offset); ctx.stroke();
      }
    }
  }
}

function lighten(hex, amount) {
  const rgb = [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + 255 * amount));
  return `rgb(${rgb.join(',')})`;
}
