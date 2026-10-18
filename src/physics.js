import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite, Constraint, Vector } = Matter;
export const STEP = 1000 / 120;
export const MAX_OBJECTS = 65;
export const MATERIALS = {
  jelly: { name: 'Jelly', color: '#97c5ef', dark: '#537fa8', radius: 48, soft: true, stiffness: 0.045, pressure: 0.00032, restitution: 0.40 },
  rubber: { name: 'Rubber', color: '#f5aa9c', dark: '#ba6555', radius: 40, soft: true, stiffness: 0.12, pressure: 0.00065, restitution: 0.72 },
  water: { name: 'Water blob', color: '#b6abd9', dark: '#80709d', radius: 51, soft: true, stiffness: 0.018, pressure: 0.00024, restitution: 0.22 },
  bouncy: { name: 'Super ball', color: '#ebcd64', dark: '#ac8b2e', radius: 24, restitution: 0.96 },
  steel: { name: 'Steel ball', color: '#a6afb3', dark: '#646e73', radius: 27, restitution: 0.3 },
  crate: { name: 'Wooden block', color: '#d7ad7c', dark: '#926d46', width: 64, height: 64 },
  plank: { name: 'Plank', color: '#c8b08b', dark: '#8c7350', width: 145, height: 20 },
  ramp: { name: 'Ramp', color: '#d5d8d0', dark: '#969f8c', width: 150, height: 16, fixed: true },
  trampoline: { name: 'Trampoline', color: '#91bba4', dark: '#5a886b', width: 132, height: 18, fixed: true, restitution: 1.18 },
  bumper: { name: 'Bumper', color: '#f6c15e', dark: '#b98531', radius: 33, fixed: true },
  fan: { name: 'Fan', color: '#a6c5c5', dark: '#5f8c8c', width: 60, height: 45, fixed: true },
  magnet: { name: 'Magnet', color: '#df9295', dark: '#a4535d', width: 54, height: 48, fixed: true },
  pin: { name: 'Bowling pin', color: '#faf7ea', dark: '#9b9b8a', width: 22, height: 73 },
};

export function polygonArea(nodes) {
  let area = 0;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].position, b = nodes[(i + 1) % nodes.length].position;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

export function centerOf(entity) {
  return entity.nodes.reduce((p, b) => ({ x: p.x + b.position.x / entity.nodes.length, y: p.y + b.position.y / entity.nodes.length }), { x: 0, y: 0 });
}

export class PhysicsRoom {
  constructor(width = 1200, height = 740) {
    this.width = width;
    this.height = height;
    this.engine = Engine.create({ enableSleeping: false, positionIterations: 8, velocityIterations: 8, constraintIterations: 5 });
    this.entities = [];
    this.serial = 0;
    this.gravity = 'earth';
    this.elapsed = 0;
    this.grab = null;
    this.press = null;
    this.onImpact = null;
    this.onBurst = null;
    Matter.Events.on(this.engine, 'collisionStart', ({ pairs }) => {
      for (const pair of pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const impact = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
        if (impact > 2.2) this.onImpact?.(a.position, Math.min(impact / 18, 1));
        const bumper = a.plugin.kind === 'bumper' ? a : b.plugin.kind === 'bumper' ? b : null;
        const other = bumper === a ? b : a;
        if (bumper && !other.isStatic) {
          const dir = Vector.normalise(Vector.sub(other.position, bumper.position));
          Body.setVelocity(other, Vector.add(other.velocity, Vector.mult(dir, 7)));
          bumper.plugin.flash = 1;
        }
      }
    });
    this.makeWalls();
    this.setGravity('earth');
  }

  makeWalls() {
    if (this.walls) Composite.remove(this.engine.world, this.walls);
    const w = this.width, h = this.height, t = 100;
    this.walls = [
      Bodies.rectangle(w / 2, h + t / 2, w + 2 * t, t, { isStatic: true }),
      Bodies.rectangle(w / 2, -t / 2, w + 2 * t, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, h / 2, t, h, { isStatic: true }),
      Bodies.rectangle(w + t / 2, h / 2, t, h, { isStatic: true }),
    ];
    this.walls.forEach(b => { b.friction = 0.5; b.restitution = 0.18; });
    Composite.add(this.engine.world, this.walls);
  }

  resize(width, height) {
    this.endGrab();
    this.releasePress(false);
    const sx = width / this.width, sy = height / this.height;
    for (const entity of this.entities) {
      const c = centerOf(entity);
      this.translate(entity, c.x * (sx - 1), c.y * (sy - 1));
    }
    this.width = width;
    this.height = height;
    this.makeWalls();
  }

  add(kind, x, y, options = {}) {
    if (!Object.hasOwn(MATERIALS, kind) || this.entities.length >= MAX_OBJECTS) return null;
    const mat = MATERIALS[kind];
    const size = Math.max(0.5, Math.min(1.65, options.size ?? 1));
    const radius = mat.radius ? mat.radius * size : 0;
    const entity = { id: ++this.serial, kind, mat, size, radius, nodes: [], constraints: [], fixed: mat.fixed || false, age: 0, trail: [] };
    x = Math.max(radius + 12, Math.min(this.width - radius - 12, x));
    y = Math.max(radius + 12, Math.min(this.height - radius - 12, y));
    if (mat.soft) {
      const count = 20, group = Body.nextGroup(true);
      entity.nodeRadius = radius * 0.165;
      const ring = radius - entity.nodeRadius;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const node = Bodies.circle(x + Math.cos(angle) * ring, y + Math.sin(angle) * ring, entity.nodeRadius, {
          collisionFilter: { group }, friction: 0.5, frictionAir: 0.008, restitution: mat.restitution, density: 0.0018, slop: 0.1,
        });
        node.plugin.entity = entity.id;
        entity.nodes.push(node);
      }
      const connect = (i, j, stiffness, damping) => entity.constraints.push(Constraint.create({ bodyA: entity.nodes[i], bodyB: entity.nodes[j], stiffness, damping }));
      for (let i = 0; i < count; i++) {
        connect(i, (i + 1) % count, 0.8, 0.035);
        connect(i, (i + 2) % count, 0.18, 0.015);
        if (i < count / 2) connect(i, i + count / 2, mat.stiffness, 0.015);
      }
      entity.restArea = polygonArea(entity.nodes);
    } else {
      const common = { isStatic: entity.fixed, friction: 0.6, frictionAir: 0.003, restitution: mat.restitution ?? 0.13, density: kind === 'steel' ? 0.012 : 0.0018, chamfer: { radius: kind === 'pin' ? 9 : 5 } };
      const body = radius ? Bodies.circle(x, y, radius, common) : Bodies.rectangle(x, y, mat.width * size, mat.height * size, common);
      body.plugin.entity = entity.id;
      body.plugin.kind = kind;
      if (kind === 'ramp') Body.setAngle(body, -0.28);
      if (options.angle != null && Number.isFinite(options.angle)) Body.setAngle(body, options.angle);
      entity.nodes.push(body);
    }
    entity.nodes.forEach(node => { node.plugin.kind = kind; });
    Composite.add(this.engine.world, [...entity.nodes, ...entity.constraints]);
    this.entities.push(entity);
    return entity;
  }

  translate(entity, x, y) { entity.nodes.forEach(b => Body.translate(b, { x, y })); }

  remove(entity) {
    if (this.grab?.entity === entity) this.endGrab();
    if (this.press?.entity === entity) this.releasePress(false);
    Composite.remove(this.engine.world, [...entity.nodes, ...entity.constraints]);
    this.entities = this.entities.filter(e => e !== entity);
  }

  clear() {
    this.endGrab(); this.releasePress(false);
    for (const e of [...this.entities]) this.remove(e);
  }

  pick(x, y) {
    for (const e of [...this.entities].reverse()) {
      if (e.mat.soft) {
        const c = centerOf(e);
        if (Math.hypot(c.x - x, c.y - y) < e.radius * 1.25) return e;
      }
      if (Matter.Query.point(e.nodes, { x, y }).length) return e;
    }
    return null;
  }

  startGrab(entity, point) {
    this.endGrab();
    if (entity.fixed) {
      this.grab = { entity, point, offset: Vector.sub(centerOf(entity), point) };
      return;
    }
    const node = entity.nodes.reduce((best, b) => Vector.magnitudeSquared(Vector.sub(b.position, point)) < Vector.magnitudeSquared(Vector.sub(best.position, point)) ? b : best);
    const offset = entity.mat.soft ? { x: 0, y: 0 } : Vector.rotate(Vector.sub(point, node.position), -node.angle);
    const joint = Constraint.create({ pointA: { ...point }, bodyB: node, pointB: offset, stiffness: entity.mat.soft ? 0.09 : 0.16, damping: 0.055, length: entity.mat.soft ? Vector.magnitude(Vector.sub(point, node.position)) : 0 });
    Composite.add(this.engine.world, joint);
    this.grab = { entity, joint, point };
  }

  moveGrab(point) {
    if (!this.grab) return;
    this.grab.point = point;
    if (this.grab.joint) this.grab.joint.pointA = { ...point };
    else {
      const c = centerOf(this.grab.entity), target = Vector.add(point, this.grab.offset);
      this.translate(this.grab.entity, target.x - c.x, target.y - c.y);
    }
  }

  endGrab() {
    if (this.grab?.joint) Composite.remove(this.engine.world, this.grab.joint);
    this.grab = null;
  }

  startPress(entity, point) {
    if (!entity.mat.soft) return false;
    this.releasePress(false);
    const c = centerOf(entity), r = entity.radius;
    const makeJaw = (y) => Bodies.rectangle(c.x, y, r * 4.8, 14, { isStatic: true, friction: 0.02, collisionFilter: { mask: 0xFFFFFFFF } });
    const jaws = [makeJaw(c.y - r - 11), makeJaw(c.y + r + 11)];
    Composite.add(this.engine.world, jaws);
    this.press = { entity, origin: { ...point }, point: { ...point }, center: c, jaws, charge: 0 };
    return true;
  }

  releasePress(launch = true) {
    if (!this.press) return;
    const { entity, jaws, charge, origin, point } = this.press;
    Composite.remove(this.engine.world, jaws);
    if (launch && charge > 0.08) {
      const aim = Vector.sub(origin, point);
      const dir = Vector.magnitude(aim) > 26 ? Vector.normalise(aim) : { x: 0, y: -1 };
      const speed = 4 + charge * 20;
      for (const node of entity.nodes) Body.setVelocity(node, Vector.mult(dir, speed));
      this.onBurst?.(centerOf(entity), entity.mat.color, 18);
    }
    this.press = null;
  }

  setGravity(mode) {
    const modes = { earth: { x: 0, y: 1 }, moon: { x: 0, y: 0.165 }, zero: { x: 0, y: 0 }, reverse: { x: 0, y: -0.65 } };
    if (!Object.hasOwn(modes, mode)) return;
    this.gravity = mode;
    Object.assign(this.engine.gravity, modes[mode]);
  }

  blast(x, y, strength = 1) {
    for (const e of this.entities) {
      if (e.fixed) continue;
      for (const b of e.nodes) {
        const d = Vector.sub(b.position, { x, y });
        const dist = Math.max(25, Vector.magnitude(d));
        if (dist < 310) {
          const force = Vector.mult(Vector.normalise(d), strength * 18 * (1 - dist / 310));
          Body.setVelocity(b, Vector.add(b.velocity, force));
        }
      }
    }
    this.onBurst?.({ x, y }, '#ed784a', 35);
  }

  step() {
    this.elapsed += STEP / 1000;
    if (this.press) {
      const p = this.press;
      p.charge = Math.min(1, p.charge + STEP / 1350);
      const r = p.entity.radius, gap = r * (1.06 - p.charge * 0.68) + 7;
      Body.setPosition(p.jaws[0], { x: p.center.x, y: p.center.y - gap });
      Body.setPosition(p.jaws[1], { x: p.center.x, y: p.center.y + gap });
    }
    const fans = this.entities.filter(e => e.kind === 'fan');
    const magnets = this.entities.filter(e => e.kind === 'magnet');
    for (const e of this.entities) {
      e.age += STEP / 1000;
      if (e.mat.soft) {
        const area = polygonArea(e.nodes);
        const pressure = Math.max(-0.8, Math.min(3, e.restArea / Math.max(e.restArea * 0.15, area) - 1)) * e.mat.pressure;
        for (let i = 0; i < e.nodes.length; i++) {
          const before = e.nodes[(i - 1 + e.nodes.length) % e.nodes.length].position;
          const after = e.nodes[(i + 1) % e.nodes.length].position;
          Body.applyForce(e.nodes[i], e.nodes[i].position, { x: (after.y - before.y) * pressure / 2, y: (before.x - after.x) * pressure / 2 });
        }
      }
      for (const b of e.nodes) {
        if (!b.isStatic) {
          for (const fan of fans) {
            const c = fan.nodes[0].position;
            const dx = b.position.x - c.x, dy = c.y - b.position.y;
            if (Math.abs(dx) < 68 && dy > 15 && dy < 380) Body.applyForce(b, b.position, { x: Math.sin(this.elapsed * 3 + dy * 0.03) * b.mass * 0.00010, y: -b.mass * 0.0021 * (1 - dy / 450) });
          }
          if (e.kind === 'steel') for (const m of magnets) {
            const d = Vector.sub(m.nodes[0].position, b.position), dist = Vector.magnitude(d);
            if (dist > 25 && dist < 300) Body.applyForce(b, b.position, Vector.mult(Vector.normalise(d), b.mass * 0.0024 * (1 - dist / 350)));
          }
        }
        if (b.plugin.flash) b.plugin.flash *= 0.96;
      }
    }
    Engine.update(this.engine, STEP);
    // Bound extreme impulses and repair only escaped/invalid states, never normal deformation.
    for (const e of [...this.entities]) {
      for (const b of e.nodes) {
        if (![b.position.x, b.position.y, b.velocity.x, b.velocity.y].every(Number.isFinite)) { this.remove(e); break; }
        if (b.speed > 45) Body.setVelocity(b, Vector.mult(Vector.normalise(b.velocity), 45));
        if (b.position.x < -60 || b.position.x > this.width + 60 || b.position.y < -60 || b.position.y > this.height + 60) {
          Body.setPosition(b, { x: Math.max(12, Math.min(this.width - 12, b.position.x)), y: Math.max(12, Math.min(this.height - 12, b.position.y)) });
          Body.setVelocity(b, Vector.mult(b.velocity, -0.3));
        }
      }
    }
  }

  serialize() {
    return { version: 1, width: this.width, height: this.height, gravity: this.gravity, entities: this.entities.map(e => ({ kind: e.kind, size: e.size, position: centerOf(e), angle: e.nodes[0].angle, nodes: e.nodes.map(b => ({ x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle, angularVelocity: b.angularVelocity })) })) };
  }

  restore(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entities) || data.entities.length > MAX_OBJECTS || !Number.isFinite(data.width) || !Number.isFinite(data.height) || data.width < 100 || data.height < 100) throw new Error('This is not a valid Squish Lab room.');
    for (const e of data.entities) {
      if (!e || !Object.hasOwn(MATERIALS, e.kind) || !e.position || ![e.position.x, e.position.y, e.size].every(Number.isFinite) || e.size < 0.5 || e.size > 1.65 || !Array.isArray(e.nodes) || e.nodes.length !== (MATERIALS[e.kind].soft ? 20 : 1) || e.nodes.some(n => !n || ![n.x, n.y, n.vx, n.vy, n.angle ?? 0, n.angularVelocity ?? 0].every(Number.isFinite) || Math.abs(n.x) > 100000 || Math.abs(n.y) > 100000)) throw new Error('This room contains invalid objects.');
    }
    this.clear();
    this.setGravity(data.gravity);
    const sx = this.width / data.width, sy = this.height / data.height;
    for (const saved of data.entities) {
      const e = this.add(saved.kind, saved.position.x * sx, saved.position.y * sy, { size: saved.size, angle: saved.angle });
      // Translate each saved shape as a whole; preserve its size across viewport changes.
      const dx = saved.position.x * (sx - 1), dy = saved.position.y * (sy - 1);
      e.nodes.forEach((b, i) => {
        const n = saved.nodes[i];
        Body.setPosition(b, { x: n.x + dx, y: n.y + dy });
        Body.setVelocity(b, { x: Math.max(-45, Math.min(45, n.vx)), y: Math.max(-45, Math.min(45, n.vy)) });
        Body.setAngle(b, n.angle ?? 0);
        Body.setAngularVelocity(b, Math.max(-1, Math.min(1, n.angularVelocity ?? 0)));
      });
    }
  }

  scene(name = 'sandbox') {
    this.clear(); this.setGravity('earth');
    const w = this.width, h = this.height;
    if (name === 'bowling') {
      this.add('rubber', w * 0.16, h - 52, { size: 1.3 });
      this.add('steel', w * 0.28, h - 32);
      for (let row = 0; row < 3; row++) for (let col = 0; col <= row; col++) this.add('pin', w * 0.66 + row * 48 + col * 3, h - 44 - col * 78);
      this.add('ramp', w * 0.37, h - 54, { angle: 0.2 });
    } else if (name === 'marbles') {
      this.add('ramp', w * 0.25, h * 0.28, { size: 1.6, angle: 0.23 });
      this.add('ramp', w * 0.64, h * 0.49, { size: 1.6, angle: -0.24 });
      this.add('trampoline', w * 0.3, h - 30);
      this.add('bumper', w * 0.45, h * 0.67);
      for (let i = 0; i < 6; i++) this.add('bouncy', w * 0.17 + i * 36, 60 + i * 6, { size: 0.65 });
      this.add('jelly', w * 0.75, h - 65);
    } else if (name === 'zero') {
      this.setGravity('zero');
      for (let i = 0; i < 8; i++) {
        const e = this.add(['jelly','rubber','water','bouncy'][i % 4], w * (0.17 + (i % 4) * 0.21), h * (0.32 + Math.floor(i / 4) * 0.37), { size: 0.85 });
        e.nodes.forEach(b => Body.setVelocity(b, { x: (i % 3 - 1) * 1.7, y: (i % 2 ? 1 : -1) * 1.2 }));
      }
      this.add('bumper', w / 2, h / 2);
    } else {
      this.add('jelly', w * 0.22, h * 0.32, { size: 1.1 });
      this.add('rubber', w * 0.50, h * 0.24);
      this.add('water', w * 0.76, h * 0.41);
      this.add('bouncy', w * 0.58, h * 0.59);
      this.add('crate', w * 0.42, h - 33);
      this.add('crate', w * 0.42, h - 100);
      this.add('plank', w * 0.34, h - 144, { angle: -0.12 });
      this.add('ramp', w * 0.71, h * 0.64, { angle: -0.28 });
      this.add('trampoline', w * 0.2, h - 20);
      this.add('steel', w * 0.86, h * 0.25);
    }
  }
}
