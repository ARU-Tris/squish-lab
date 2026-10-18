import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite, Constraint, Vector } = Matter;
export const STEP = 1000 / 120;
export const MAX_OBJECTS = 65;
import { MATERIALS, restShape } from './materials.js';
export { MATERIALS };

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

export function poseOf(entity) {
  const c = centerOf(entity);
  let dot = 0, cross = 0;
  for (let i = 0; i < entity.nodes.length; i++) {
    const p = entity.restPoints[i], q = Vector.sub(entity.nodes[i].position, c);
    dot += p.x * q.x + p.y * q.y;
    cross += p.x * q.y - p.y * q.x;
  }
  return { position: c, angle: Math.atan2(cross, dot) };
}

export function shapeTransform(entity) {
  const position = centerOf(entity);
  let xx = 0, yy = 0, xy = 0, ux = 0, uy = 0, vx = 0, vy = 0;
  for (let i = 0; i < entity.nodes.length; i++) {
    const p = entity.restPoints[i], q = Vector.sub(entity.nodes[i].position, position);
    xx += p.x * p.x; yy += p.y * p.y; xy += p.x * p.y;
    ux += q.x * p.x; uy += q.x * p.y; vx += q.y * p.x; vy += q.y * p.y;
  }
  const det = xx * yy - xy * xy || 1;
  const a = (ux * yy - uy * xy) / det, c = (uy * xx - ux * xy) / det;
  const b = (vx * yy - vy * xy) / det, d = (vy * xx - vx * xy) / det;
  const trace = a * a + b * b + c * c + d * d;
  const minStretch = Math.sqrt(Math.max(0, (trace - Math.sqrt(Math.max(0, trace * trace - 4 * (a * d - b * c) ** 2))) / 2));
  return { position, a, b, c, d, compression: Math.max(0, Math.min(1, 1 - minStretch)) };
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
    this.onImpact = null;
    this.onBurst = null;
    Matter.Events.on(this.engine, 'collisionStart', ({ pairs }) => {
      const boosted = new Set();
      for (const pair of pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        const impact = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
        if (impact > 2.2) this.onImpact?.(a.position, Math.min(impact / 18, 1));
        const bumper = a.plugin.kind === 'bumper' ? a : b.plugin.kind === 'bumper' ? b : null;
        if (!bumper) continue;
        const other = bumper === a ? b : a;
        const entity = this.entities.find(e => e.id === other.plugin.entity);
        if (entity && !entity.fixed && !boosted.has(entity.id)) {
          boosted.add(entity.id);
          const bumperEntity = this.entities.find(e => e.id === bumper.plugin.entity);
          const dir = Vector.normalise(Vector.sub(centerOf(entity), centerOf(bumperEntity)));
          entity.nodes.forEach(n => Body.setVelocity(n, Vector.add(n.velocity, Vector.mult(dir, 7))));
          bumperEntity.nodes[0].plugin.flash = 1;
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
    const sx = width / this.width, sy = height / this.height;
    for (const entity of this.entities) {
      const c = centerOf(entity);
      this.translate(entity, c.x * (sx - 1), c.y * (sy - 1));
    }
    this.width = width;
    this.height = height;
    this.makeWalls();
    for (const entity of this.entities) if (entity.fixed) this.mount(entity);
  }

  add(kind, x, y, options = {}) {
    if (!Object.hasOwn(MATERIALS, kind) || this.entities.length >= MAX_OBJECTS) return null;
    const mat = MATERIALS[kind];
    const size = Math.max(0.5, Math.min(1.65, options.size ?? 1));
    const radius = mat.radius ? mat.radius * size : 0;
    const entity = { id: ++this.serial, kind, mat, size, radius, nodes: [], constraints: [], fixed: mat.fixed || false, age: 0, trail: [] };
    x = Math.max(radius + 12, Math.min(this.width - radius - 12, x));
    y = Math.max(radius + 12, Math.min(this.height - radius - 12, y));
    const shape = restShape(mat, size), count = shape.points.length, group = Body.nextGroup(true);
    entity.restPoints = shape.points;
    entity.nodeRadius = shape.nodeRadius;
    entity.mounts = [];
    const angle = options.angle ?? (kind === 'ramp' ? -0.28 : 0);
    const area = radius ? Math.PI * radius * radius : mat.width * mat.height * size * size;
    const mass = area * (mat.density ?? (mat.soft ? 0.001 : 0.0018));
    for (const local of shape.points) {
      const rotated = Vector.rotate(local, angle);
      const node = Bodies.circle(x + rotated.x, y + rotated.y, entity.nodeRadius, {
        collisionFilter: { group }, friction: mat.soft ? 0.5 : 0.6, frictionAir: mat.soft ? 0.008 : 0.003,
        restitution: mat.restitution ?? 0.13, slop: 0.08,
      });
      Body.setMass(node, mass / count);
      node.plugin.entity = entity.id;
      entity.nodes.push(node);
    }
    const links = new Set();
    const connect = (i, j, stiffness, damping = 0.025) => {
      const key = [Math.min(i,j), Math.max(i,j)].join(':');
      if (i === j || links.has(key)) return;
      links.add(key);
      entity.constraints.push(Constraint.create({ bodyA: entity.nodes[i], bodyB: entity.nodes[j], stiffness, damping }));
    };
    for (let i = 0; i < count; i++) {
      connect(i, (i + 1) % count, 0.8);
      connect(i, (i + 2) % count, mat.soft ? 0.18 : Math.max(0.3, mat.stiffness));
      connect(i, (i + Math.floor(count / 2)) % count, mat.stiffness);
      if (!mat.soft) {
        connect(i, (i + Math.floor(count / 3)) % count, mat.stiffness * 0.75);
        connect(i, (i + Math.floor(count / 2) + 2) % count, mat.stiffness * 0.75);
      }
    }
    entity.restArea = polygonArea(entity.nodes);
    entity.nodes.forEach(node => { node.plugin.kind = kind; });
    Composite.add(this.engine.world, [...entity.nodes, ...entity.constraints]);
    this.entities.push(entity);
    if (entity.fixed) this.mount(entity);
    return entity;
  }

  translate(entity, x, y) {
    entity.nodes.forEach(b => Body.translate(b, { x, y }));
    for (const mount of entity.mounts) { mount.pointA.x += x; mount.pointA.y += y; }
  }

  remove(entity) {
    if (this.grab?.entity === entity) this.endGrab();
    Composite.remove(this.engine.world, [...entity.nodes, ...entity.constraints, ...entity.mounts]);
    this.entities = this.entities.filter(e => e !== entity);
  }

  clear() {
    this.endGrab();
    for (const e of [...this.entities]) this.remove(e);
  }

  pick(x, y) {
    for (const e of [...this.entities].reverse()) {
      // Test the enclosed material as well as the membrane particles.
      let inside = false;
      for (let i = 0, j = e.nodes.length - 1; i < e.nodes.length; j = i++) {
        const a = e.nodes[i].position, b = e.nodes[j].position;
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      }
      if (inside || Matter.Query.point(e.nodes, { x, y }).length) return e;
    }
    return null;
  }

  mount(entity) {
    Composite.remove(this.engine.world, entity.mounts);
    const c = centerOf(entity), angle = poseOf(entity).angle;
    const points = entity.restPoints.map(p => Vector.rotate(p, angle));
    const xExtent = Math.max(...points.map(p => Math.abs(p.x))) + entity.nodeRadius + 1;
    const yExtent = Math.max(...points.map(p => Math.abs(p.y))) + entity.nodeRadius + 1;
    const origin = { x: Math.max(xExtent, Math.min(this.width - xExtent, c.x)), y: Math.max(yExtent, Math.min(this.height - yExtent, c.y)) };
    entity.mounts = entity.nodes.map((b, i) => Constraint.create({ pointA: Vector.add(origin, points[i]), bodyB: b, length: 0, stiffness: 0.28, damping: 0.1 }));
    Composite.add(this.engine.world, entity.mounts);
  }

  rotate(entity, angle) {
    const c = centerOf(entity);
    entity.nodes.forEach(b => Body.setPosition(b, Vector.add(c, Vector.rotate(Vector.sub(b.position, c), angle))));
    if (entity.fixed) this.mount(entity);
  }

  startGrab(entity, point) {
    this.endGrab();
    if (entity.fixed) {
      Composite.remove(this.engine.world, entity.mounts);
      entity.mounts = [];
    }
    this.grab = { entity, point: { ...point }, offset: Vector.sub(centerOf(entity), point), acceleration: { x: 0, y: 0 } };
  }

  moveGrab(point) {
    if (this.grab) this.grab.point = { ...point };
  }

  endGrab() {
    if (!this.grab) return;
    const entity = this.grab.entity;
    this.grab = null;
    if (entity.fixed) this.mount(entity);
  }

  driveGrab() {
    if (!this.grab) return;
    const g = this.grab, e = g.entity, c = centerOf(e);
    const target = Vector.add(g.point, g.offset);
    const velocity = e.nodes.reduce((v, b) => Vector.add(v, Vector.mult(b.velocity, 1 / e.nodes.length)), { x: 0, y: 0 });
    // A distributed hand force transports the whole toy in free space. Contact
    // blocks the leading surface, so the same force naturally compresses it.
    let a = Vector.sub(Vector.mult(Vector.sub(target, c), 0.00040), Vector.mult(velocity, 0.0023));
    const magnitude = Vector.magnitude(a);
    if (magnitude > 0.055) a = Vector.mult(a, 0.055 / magnitude);
    g.acceleration = a;
    for (const b of e.nodes) Body.applyForce(b, b.position, {
      x: b.mass * (a.x - (!e.fixed ? this.engine.gravity.x * this.engine.gravity.scale : 0)),
      y: b.mass * (a.y - (!e.fixed ? this.engine.gravity.y * this.engine.gravity.scale : 0)),
    });
  }

  preserveMembrane(entity) {
    // Unconnected sides still occupy space. Self-contact and inversion
    // constraints keep a compressed boundary from passing through itself.
    const nodes = entity.nodes, count = nodes.length;
    const move = (node, dx, dy) => {
      Body.setPosition(node, {
        x: Math.max(entity.nodeRadius * 0.85, Math.min(this.width - entity.nodeRadius * 0.85, node.position.x + dx)),
        y: Math.max(entity.nodeRadius * 0.85, Math.min(this.height - entity.nodeRadius * 0.85, node.position.y + dy)),
      });
      // The solver's cached correction describes the old, possibly inverted
      // configuration. Do not replay it after an elastic projection.
      node.constraintImpulse.x = 0; node.constraintImpulse.y = 0; node.constraintImpulse.angle = 0;
    };
    if (entity.mat.soft) {
      const pose = poseOf(entity), stiffness = 0.12 + entity.mat.stiffness * 0.30;
      for (let i = 0; i < count; i++) {
        const target = Vector.add(pose.position, Vector.rotate(entity.restPoints[i], pose.angle));
        const correction = Vector.mult(Vector.sub(target, nodes[i].position), stiffness);
        move(nodes[i], correction.x, correction.y);
      }
    }
    if (!entity.mat.soft && polygonArea(nodes) > entity.restArea * 0.60) return;
    for (let iteration = 0; iteration < 4; iteration++) {
      const pose = poseOf(entity);
      if (entity.mat.soft) for (let i = 0; i < count; i++) {
        const previous = nodes[(i + count - 1) % count], current = nodes[i], next = nodes[(i + 1) % count];
        const chord = Vector.sub(next.position, previous.position);
        const normal = Vector.normalise({ x: chord.y, y: -chord.x });
        const midpoint = Vector.mult(Vector.add(previous.position, next.position), 0.5);
        const signedBend = Vector.dot(Vector.sub(current.position, midpoint), normal);
        if (signedBend >= 0) continue;
        // Signed bending distinguishes a compressed edge from its mirrored,
        // inside-out solution, which distance-only springs cannot distinguish.
        const correction = Vector.mult(normal, Math.min(12, -signedBend * 1.2));
        move(current, correction.x, correction.y);
        move(previous, -correction.x * 0.5, -correction.y * 0.5);
        move(next, -correction.x * 0.5, -correction.y * 0.5);
      }
      const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      for (let i = 0; i < count; i++) for (let j = i + 2; j < count; j++) {
        if (i === 0 && j === count - 1) continue;
        const indices = [i, (i + 1) % count, j, (j + 1) % count];
        const [a,b,c,d] = indices.map(index => nodes[index].position);
        if (cross(a,b,c) * cross(a,b,d) >= 0 || cross(c,d,a) * cross(c,d,b) >= 0) continue;
        // Recover the intended spring orientation locally, rather than letting
        // a crossed edge settle into an inside-out triangle after release.
        for (const index of indices) {
          const target = Vector.add(pose.position, Vector.rotate(entity.restPoints[index], pose.angle));
          let correction = Vector.mult(Vector.sub(target, nodes[index].position), 0.45);
          const length = Vector.magnitude(correction);
          if (length > 5) correction = Vector.mult(correction, 5 / length);
          move(nodes[index], correction.x, correction.y);
        }
      }
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        const separation = Math.min(j - i, count - j + i);
        if (separation <= 1) continue;
        const rest = Vector.magnitude(Vector.sub(entity.restPoints[i], entity.restPoints[j]));
        const minimum = Math.min(entity.nodeRadius * 1.85, rest * 0.8);
        const delta = Vector.sub(nodes[j].position, nodes[i].position), distance = Vector.magnitude(delta);
        if (distance >= minimum) continue;
        const direction = distance > 0.001 ? Vector.mult(delta, 1 / distance) : Vector.normalise(Vector.sub(entity.restPoints[j], entity.restPoints[i]));
        const correction = Vector.mult(direction, Math.min(3, (minimum - distance) * 0.5));
        move(nodes[i], -correction.x, -correction.y); move(nodes[j], correction.x, correction.y);
      }
      const deficit = entity.restArea * 0.32 - polygonArea(nodes);
      if (deficit <= 0) continue;
      const gradients = nodes.map((_, i) => {
        const a = nodes[(i + count - 1) % count].position, b = nodes[(i + 1) % count].position;
        return { x: (b.y - a.y) / 2, y: (a.x - b.x) / 2 };
      });
      const denominator = gradients.reduce((sum, g) => sum + g.x * g.x + g.y * g.y, 0) || 1;
      for (let i = 0; i < count; i++) {
        let delta = Vector.mult(gradients[i], deficit / denominator);
        const length = Vector.magnitude(delta);
        if (length > 3) delta = Vector.mult(delta, 3 / length);
        move(nodes[i], delta.x, delta.y);
      }
    }
  }

  dampDeformation(entity) {
    if (!entity.mat.soft) return;
    const c = centerOf(entity);
    const velocity = entity.nodes.reduce((sum, n) => Vector.add(sum, Vector.mult(n.velocity, 1 / entity.nodes.length)), { x: 0, y: 0 });
    let spin = 0, inertia = 0;
    for (const n of entity.nodes) {
      const r = Vector.sub(n.position, c), v = Vector.sub(n.velocity, velocity);
      spin += r.x * v.y - r.y * v.x; inertia += r.x * r.x + r.y * r.y;
    }
    spin /= inertia || 1;
    const damping = entity.kind === 'water' ? 0.92 : entity.kind === 'jelly' ? 0.94 : 0.97;
    for (const n of entity.nodes) {
      const r = Vector.sub(n.position, c);
      const rigid = { x: velocity.x - spin * r.y, y: velocity.y + spin * r.x };
      Body.setVelocity(n, Vector.add(rigid, Vector.mult(Vector.sub(n.velocity, rigid), damping)));
    }
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
    this.driveGrab();
    const fans = this.entities.filter(e => e.kind === 'fan');
    const magnets = this.entities.filter(e => e.kind === 'magnet');
    for (const e of this.entities) {
      e.age += STEP / 1000;
      {
        const area = polygonArea(e.nodes);
        const volumeRatio = e.restArea / Math.max(e.restArea * 0.15, area);
        // Bulk resistance rises sharply near collapse, like a compressed
        // elastic material, while ordinary squishing stays compliant.
        const bulk = Math.max(1, (volumeRatio / 1.7) ** 4);
        const pressure = Math.max(-0.8, Math.min(24, (volumeRatio - 1) * bulk)) * e.mat.pressure;
        for (let i = 0; i < e.nodes.length; i++) {
          const before = e.nodes[(i - 1 + e.nodes.length) % e.nodes.length].position;
          const after = e.nodes[(i + 1) % e.nodes.length].position;
          Body.applyForce(e.nodes[i], e.nodes[i].position, { x: (after.y - before.y) * pressure / 2, y: (before.x - after.x) * pressure / 2 });
        }
      }
      for (const b of e.nodes) {
        if (e.fixed) Body.applyForce(b, b.position, { x: -b.mass * this.engine.gravity.x * this.engine.gravity.scale, y: -b.mass * this.engine.gravity.y * this.engine.gravity.scale });
        if (!e.fixed) {
          for (const fan of fans) {
            const c = centerOf(fan);
            const dx = b.position.x - c.x, dy = c.y - b.position.y;
            if (Math.abs(dx) < 68 && dy > 15 && dy < 380) Body.applyForce(b, b.position, { x: Math.sin(this.elapsed * 3 + dy * 0.03) * b.mass * 0.00010, y: -b.mass * 0.0021 * (1 - dy / 450) });
          }
          if (e.kind === 'steel') for (const m of magnets) {
            const d = Vector.sub(centerOf(m), b.position), dist = Vector.magnitude(d);
            if (dist > 25 && dist < 300) Body.applyForce(b, b.position, Vector.mult(Vector.normalise(d), b.mass * 0.0024 * (1 - dist / 350)));
          }
        }
        if (b.plugin.flash) b.plugin.flash *= 0.96;
      }
    }
    Engine.update(this.engine, STEP);
    for (const e of this.entities) { this.dampDeformation(e); this.preserveMembrane(e); }
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
    return { version: 2, width: this.width, height: this.height, gravity: this.gravity, entities: this.entities.map(e => ({ kind: e.kind, size: e.size, position: centerOf(e), angle: poseOf(e).angle, nodes: e.nodes.map(b => ({ x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle, angularVelocity: b.angularVelocity })) })) };
  }

  restore(data) {
    if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.entities) || data.entities.length > MAX_OBJECTS || !Number.isFinite(data.width) || !Number.isFinite(data.height) || data.width < 100 || data.height < 100) throw new Error('This is not a valid Squish Lab room.');
    for (const e of data.entities) {
      if (!e || !Object.hasOwn(MATERIALS, e.kind) || !e.position || ![e.position.x, e.position.y, e.size, e.angle ?? 0].every(Number.isFinite) || e.size < 0.5 || e.size > 1.65 || !Array.isArray(e.nodes)) throw new Error('This room contains invalid objects.');
      const expected = data.version === 1 ? (MATERIALS[e.kind].soft ? 20 : 1) : restShape(MATERIALS[e.kind], e.size).points.length;
      if (e.nodes.length !== expected || e.nodes.some(n => !n || ![n.x, n.y, n.vx, n.vy, n.angle ?? 0, n.angularVelocity ?? 0].every(Number.isFinite) || Math.abs(n.x) > 100000 || Math.abs(n.y) > 100000)) throw new Error('This room contains invalid objects.');
    }
    this.clear();
    this.setGravity(data.gravity);
    const sx = this.width / data.width, sy = this.height / data.height;
    for (const saved of data.entities) {
      const e = this.add(saved.kind, saved.position.x * sx, saved.position.y * sy, { size: saved.size, angle: saved.angle });
      const dx = saved.position.x * (sx - 1), dy = saved.position.y * (sy - 1);
      const legacySolid = data.version === 1 && !e.mat.soft;
      e.nodes.forEach((b, i) => {
        const n = saved.nodes[legacySolid ? 0 : i];
        if (!legacySolid) Body.setPosition(b, { x: n.x + dx, y: n.y + dy });
        Body.setVelocity(b, { x: Math.max(-45, Math.min(45, n.vx)), y: Math.max(-45, Math.min(45, n.vy)) });
        if (!legacySolid) Body.setAngle(b, n.angle ?? 0);
        Body.setAngularVelocity(b, Math.max(-1, Math.min(1, n.angularVelocity ?? 0)));
      });
      if (e.fixed) this.mount(e);
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
